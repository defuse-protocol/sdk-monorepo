import {
	assert,
	type ILogger,
	type EnvConfig,
	withTimeout,
} from "@defuse-protocol/internal-utils";
import { type HotBridge as HotSdk, OMNI_HOT_V2 } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
import { LRUCache } from "lru-cache";
import * as v from "valibot";
import {
	InvalidDestinationAddressForWithdrawalError,
	TrustlineNotFoundError,
	UnsupportedAssetIdError,
	UnsupportedDestinationMemoError,
} from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { type Chain, Chains } from "../../lib/caip2";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	QuoteOptions,
	RouteConfig,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalStatus,
} from "../../shared-types";
import { getUnderlyingFee } from "../../lib/estimate-fee";
import {
	HotWithdrawalApiFeeRequestTimeoutError,
	HotWithdrawalNotFoundError,
} from "./error";
import { HotWithdrawStatus, MIN_GAS_AMOUNT } from "./hot-bridge-constants";
import {
	formatTxHash,
	getFeeAssetIdForChain,
	hotBlockchainInvariant,
	hotNetworkIdToCAIP2,
	toHotNetworkId,
} from "./hot-bridge-utils";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import { getFeeQuote } from "../../lib/estimate-fee";
import { validateAddress } from "../../lib/validateAddress";
import isHex from "../../lib/hex";
import { bridgeIndexer } from "@defuse-protocol/internal-utils";

const HotApiWithdrawalSchema = v.object({
	hash: v.nullable(v.string()),
	nonce: v.string(),
	near_trx: v.string(),
	verified_withdraw: v.boolean(),
	chain_id: v.number(),
});

const HotApiWithdrawalResponseSchema = v.object({
	hash: v.nullable(v.string()),
	nonce: v.string(),
	near_trx: v.string(),
	withdrawals: v.array(HotApiWithdrawalSchema),
});

export class HotBridge implements Bridge {
	private static readonly API_FALLBACK_TIMEOUT_MS = 5000;
	private static readonly NEAR_RPC_TIMEOUT_MS = 10000;

	readonly route = RouteEnum.HotBridge;
	protected envConfig: EnvConfig;
	protected hotSdk: HotSdk;
	protected solverRelayApiKey: string | undefined;

	// Nonces are immutable for a given tx, use LRU with fetchMethod for readthrough
	private noncesCache: LRUCache<`${string}:${string}`, bigint[], NearTxInfo>;

	constructor({
		envConfig,
		hotSdk,
		solverRelayApiKey,
	}: { envConfig: EnvConfig; hotSdk: HotSdk; solverRelayApiKey?: string }) {
		this.envConfig = envConfig;
		this.hotSdk = hotSdk;
		this.solverRelayApiKey = solverRelayApiKey;
		this.noncesCache = new LRUCache<
			`${string}:${string}`,
			bigint[],
			NearTxInfo
		>({
			max: 50,
			ttl: 60 * 60 * 1000, // 1 hour
			fetchMethod: async (_key, _staleValue, { context: tx }) => {
				return withTimeout(
					() => this.hotSdk.near.parseWithdrawalNonces(tx.hash, tx.accountId),
					{ timeout: HotBridge.NEAR_RPC_TIMEOUT_MS },
				);
			},
		});
	}

	private getNoncesCacheKey(tx: NearTxInfo): `${string}:${string}` {
		return `${tx.hash}:${tx.accountId}`;
	}

	private is(routeConfig: RouteConfig): boolean {
		return routeConfig.route === RouteEnum.HotBridge;
	}

	async supports(
		params: Pick<WithdrawalParams, "assetId" | "routeConfig">,
	): Promise<boolean> {
		if (params.routeConfig != null && !this.is(params.routeConfig)) {
			return false;
		}

		const assetInfo = this.parseAssetId(params.assetId);
		const isValid = assetInfo != null;

		if (!isValid && params.routeConfig != null) {
			throw new UnsupportedAssetIdError(
				params.assetId,
				"`assetId` does not match `routeConfig`.",
			);
		}
		return isValid;
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);

		const contractIdSatisfies = parsed.contractId === OMNI_HOT_V2;

		if (!contractIdSatisfies) {
			return null;
		}

		if (parsed.standard !== "nep245") {
			throw new UnsupportedAssetIdError(
				assetId,
				'Should start with "nep245:".',
			);
		}
		const [chainId, address] = utils.fromOmni(parsed.tokenId).split(":");
		if (chainId == null || address == null) {
			throw new UnsupportedAssetIdError(
				assetId,
				"Asset has invalid token id format.",
			);
		}

		let blockchain: Chain;
		try {
			blockchain = hotNetworkIdToCAIP2(chainId);
		} catch {
			throw new UnsupportedAssetIdError(
				assetId,
				"Asset belongs to unknown blockchain.",
			);
		}

		return Object.assign(
			parsed,
			{
				blockchain,
				bridgeName: BridgeNameEnum.Hot,
			},
			(address === "native" ? { native: true } : { address }) as
				| { native: true }
				| { address: string },
		);
	}

	async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		// Validate that `destinationMemo` is not accidentally used with Stellar or TON
		if (
			args.withdrawalParams.destinationMemo != null &&
			args.withdrawalParams.destinationMemo !== ""
		) {
			throw new UnsupportedDestinationMemoError(
				assetInfo.blockchain,
				args.withdrawalParams.assetId,
			);
		}

		const intents: IntentPrimitive[] = [];
		const feeAmount = getUnderlyingFee(
			args.feeEstimation,
			RouteEnum.HotBridge,
			"relayerFee",
		);
		const blockNumber = getUnderlyingFee(
			args.feeEstimation,
			RouteEnum.HotBridge,
			"blockNumber",
		);

		if (args.feeEstimation.quote !== null) {
			intents.push({
				intent: "token_diff",
				diff: {
					[args.feeEstimation.quote.defuse_asset_identifier_in]:
						`-${args.feeEstimation.quote.amount_in}`,
					[args.feeEstimation.quote.defuse_asset_identifier_out]:
						args.feeEstimation.quote.amount_out,
				},
				referral: args.referral,
			});
		}

		const isNative = "native" in assetInfo;
		const amount = args.withdrawalParams.amount + (isNative ? feeAmount : 0n);

		const intent = await this.hotSdk.buildGaslessWithdrawIntent({
			feeToken: "native",
			feeAmount,
			blockNumber,
			chain: toHotNetworkId(assetInfo.blockchain),
			token: isNative ? "native" : assetInfo.address,
			amount,
			receiver: args.withdrawalParams.destinationAddress,
		});

		// Sanity check, in case HOT SDK changes
		assert(intent.amounts[0] === amount.toString(), "Amount is not correct");
		if (intent.amounts.length === 2) {
			assert(
				intent.amounts[1] === feeAmount.toString(),
				"Amount is not correct",
			);
		}

		const mtWithdrawIntent = intent as Extract<
			IntentPrimitive,
			{ intent: "mt_withdraw" }
		>;
		mtWithdrawIntent.min_gas = MIN_GAS_AMOUNT;

		intents.push(mtWithdrawIntent);

		return intents;
	}

	/**
	 * Hot bridge validates trustlines for Stellar addresses.
	 * For Stellar chains, checks if the destination address has the required trustline.
	 * @throws {TrustlineNotFoundError} If Stellar destination address lacks required trustline
	 */
	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		logger?: ILogger;
	}): Promise<void> {
		const assetInfo = this.parseAssetId(args.assetId);
		assert(assetInfo != null, "Asset is not supported");
		hotBlockchainInvariant(assetInfo.blockchain);

		if (
			validateAddress(args.destinationAddress, assetInfo.blockchain) === false
		) {
			throw new InvalidDestinationAddressForWithdrawalError(
				args.destinationAddress,
				assetInfo.blockchain,
			);
		}

		if (assetInfo.blockchain === Chains.Stellar) {
			const token = "native" in assetInfo ? "native" : assetInfo.address;

			const hasTrustline = await this.hotSdk.stellar.isTrustlineExists(
				args.destinationAddress,
				token,
			);

			if (!hasTrustline) {
				throw new TrustlineNotFoundError(
					args.destinationAddress,
					args.assetId,
					assetInfo.blockchain,
					token,
				);
			}
		}
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<WithdrawalParams, "assetId" | "destinationAddress">;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");
		hotBlockchainInvariant(assetInfo.blockchain);
		const feeAssetId = getFeeAssetIdForChain(assetInfo.blockchain);

		const { gasPrice: feeAmount, blockNumber } = await withTimeout(
			async () => {
				const result = await this.hotSdk.getGaslessWithdrawFee({
					chain: toHotNetworkId(assetInfo.blockchain),
					token: "native" in assetInfo ? "native" : assetInfo.address,
					receiver: args.withdrawalParams.destinationAddress,
				});
				if (
					assetInfo.blockchain === Chains.Plasma &&
					args.withdrawalParams.assetId !== feeAssetId
				) {
					// Plasma withdrawals require inflated gas price for solver to quote non-native tokens
					result.gasPrice *= 20n;
				}
				return result;
			},
			{
				errorInstance: new HotWithdrawalApiFeeRequestTimeoutError(),
				timeout: typeof window !== "undefined" ? 10_000 : 3000,
			},
		);

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId || feeAmount === 0n
				? null
				: await getFeeQuote({
						feeAmount,
						feeAssetId,
						tokenAssetId: args.withdrawalParams.assetId,
						logger: args.logger,
						envConfig: this.envConfig,
						quoteOptions: args.quoteOptions,
						solverRelayApiKey: this.solverRelayApiKey,
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
			quote: feeQuote,
			underlyingFees: {
				[RouteEnum.HotBridge]: { relayerFee: feeAmount, blockNumber },
			},
		};
	}

	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const landingChain = assetInfo.blockchain;

		return {
			landingChain,
			index: args.index,
			withdrawalParams: args.withdrawalParams,
			tx: args.tx,
		};
	}

	async describeWithdrawal(
		args: WithdrawalIdentifier & { logger?: ILogger },
	): Promise<WithdrawalStatus> {
		const cacheKey = this.getNoncesCacheKey(args.tx);
		const nonces = await this.noncesCache.fetch(cacheKey, { context: args.tx });
		if (nonces == null) {
			throw new HotWithdrawalNotFoundError(args.tx.hash, args.index);
		}

		const nonce = nonces[args.index];
		if (nonce == null) {
			throw new HotWithdrawalNotFoundError(args.tx.hash, args.index);
		}
		const isEvm = args.landingChain.startsWith("eip155:");
		// Use bridge indexer as single source of truth for EVM networks
		if (isEvm) {
			try {
				const bridgeIndexerHash = await this.fetchWithdrawalHashBridgeIndexer(
					args.tx.hash,
					nonce.toString(),
					args.logger,
				);
				if (bridgeIndexerHash !== null) {
					args.logger?.info(
						`Bridge indexer returned withdrawHash=${bridgeIndexerHash} for nearTxHash=${args.tx.hash} nonce=${nonce.toString()}`,
					);
					return {
						status: "completed",
						txHash: bridgeIndexerHash,
					};
				}
			} catch (error) {
				// Bridge indexer failed, fall back to API
				args.logger?.error(
					"Bridge indexer failed unexpectedly, trying HOT API fallback",
					{
						nearTxHash: args.tx.hash,
						nonce: nonce.toString(),
						error,
					},
				);
				const apiHash = await this.fetchWithdrawalHashFromApi(
					args.tx.hash,
					nonce,
					args.logger,
				);
				if (apiHash != null) {
					args.logger?.info(
						`Hot Api returned withdrawHash=${apiHash} for nearTxHash=${args.tx.hash} nonce=${nonce.toString()}`,
					);
					return {
						status: "completed",
						txHash: formatTxHash(apiHash, args.landingChain),
					};
				}
			}
		} else {
			// Fallback for other non EVM networks
			// Primary source: contract view method
			const status: unknown = await this.hotSdk.getGaslessWithdrawStatus(
				nonce.toString(),
			);

			if (status === HotWithdrawStatus.Canceled) {
				return {
					status: "failed",
					reason: "Withdrawal was cancelled",
				};
			}
			if (status === HotWithdrawStatus.Completed) {
				return { status: "completed", txHash: null };
			}
			if (typeof status === "string") {
				// HOT returns hexified raw bytes without 0x prefix, any other value should be ignored.
				if (!isHex(status)) {
					args.logger?.warn(
						"HOT Bridge incorrect destination tx hash detected",
						{
							value: status,
						},
					);
					return { status: "completed", txHash: null };
				}
				return {
					status: "completed",
					txHash: formatTxHash(status, args.landingChain),
				};
			}

			// Fallback: API indexer (when contract returns null/pending)
			const apiHash = await this.fetchWithdrawalHashFromApi(
				args.tx.hash,
				nonce,
				args.logger,
			);
			if (apiHash != null) {
				return {
					status: "completed",
					txHash: formatTxHash(apiHash, args.landingChain),
				};
			}
		}

		return { status: "pending" };
	}

	private async fetchWithdrawalHashBridgeIndexer(
		nearTxHash: string,
		nonce: string,
		logger?: ILogger,
	): Promise<string | null> {
		const { withdrawals } =
			await bridgeIndexer.httpClient.withdrawalsByNearTxHash(nearTxHash, {
				timeout: typeof window !== "undefined" ? 10_000 : 3000,
				logger,
			});

		const withdrawal = withdrawals.find((withdrawal) => {
			return withdrawal.nonce === nonce;
		});

		if (withdrawal === undefined) {
			logger?.info("HOT Bridge indexer withdrawal hash not found", {
				nearTxHash,
				nonce: nonce.toString(),
			});
			return null;
		}

		return withdrawal.hash || null;
	}
	private async fetchWithdrawalHashFromApi(
		nearTxHash: string,
		nonce: bigint,
		logger?: ILogger,
	): Promise<string | null> {
		try {
			const response = await withTimeout(
				() =>
					this.hotSdk.api.requestApi(
						`/api/v1/evm/bridge_withdrawal_hash?near_trx=${nearTxHash}`,
						{ method: "GET" },
					),
				{ timeout: HotBridge.API_FALLBACK_TIMEOUT_MS },
			);
			const data: unknown = await response.json();

			const parseResult = v.safeParse(HotApiWithdrawalResponseSchema, data);
			if (!parseResult.success) {
				logger?.debug("HOT API response parse failed", {
					issues: parseResult.issues,
				});
				return null;
			}

			const withdrawal = parseResult.output.withdrawals.find(
				(w) => w.nonce === nonce.toString(),
			);

			if (withdrawal?.hash) {
				const hash = withdrawal.hash.replace(/^0x/, "");
				if (isHex(hash)) {
					logger?.info("HOT withdrawal hash found via API fallback", {
						nearTxHash,
						nonce: nonce.toString(),
					});
					return hash;
				}
			}
			return null;
		} catch (error) {
			logger?.debug("HOT API fallback failed", { error, nearTxHash });
			return null;
		}
	}
}

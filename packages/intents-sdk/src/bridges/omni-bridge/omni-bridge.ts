import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	RETRY_CONFIGS,
	type RetryOptions,
	configsByEnvironment,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	solverRelay,
	utils,
} from "@defuse-protocol/internal-utils";
import TTLCache from "@isaacs/ttlcache";
import { retry } from "@lifeomic/attempt";
import type { providers } from "near-api-js";
import {
	ChainKind,
	type OmniAddress,
	OmniBridgeAPI,
	getChain,
	isEvmChain,
	omniAddress,
	parseOriginChain,
} from "omni-bridge-sdk";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	RouteConfig,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	OmniTransferDestinationChainHashNotFoundError,
	OmniTransferNotFoundError,
	TokenNotSupportedByOmniRelayerError,
} from "./error";
import {
	NEAR_NATIVE_ASSET_ID,
	OMNI_BRIDGE_CONTRACT,
} from "./omni-bridge-constants";
import {
	caip2ToChainKind,
	chainKindToCaip2,
	createWithdrawIntentPrimitive,
} from "./omni-bridge-utils";

type MinStorageBalance = bigint;
type StorageDepositBalance = bigint;
export class OmniBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;
	protected omniBridgeAPI: OmniBridgeAPI;
	private storageDepositCache = new TTLCache<
		string,
		[MinStorageBalance, StorageDepositBalance]
	>({ ttl: 86400000 }); // 86400000 - 1 day
	private static readonly SUPPORTED_TOKENS_CACHE_KEY: string =
		"SUPPORTED_TOKENS_CACHE_KEY";
	// TTL cache for supported tokens with 30-second TTL
	private supportedTokensCache = new TTLCache<
		string,
		Record<string, OmniAddress>
	>({ ttl: 86400000 }); // 86400000 - 1 day

	constructor({
		env,
		nearProvider,
	}: { env: NearIntentsEnv; nearProvider: providers.Provider }) {
		this.env = env;
		this.nearProvider = nearProvider;
		this.omniBridgeAPI = new OmniBridgeAPI();
	}

	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.OmniBridge;
	}

	supports(params: Pick<WithdrawalParams, "assetId" | "routeConfig">): boolean {
		try {
			return this.parseAssetId(params.assetId) !== null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = utils.parseDefuseAssetId(assetId);
		if (parsed.standard !== "nep141") return null;
		const chain = parseOriginChain(parsed.contractId);
		if (chain === null) return null;
		return Object.assign(parsed, {
			blockchain: chainKindToCaip2(chain),
			bridgeName: BridgeNameEnum.Omni,
			address: parsed.contractId,
		});
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(
			assetInfo !== null,
			`Asset ${args.withdrawalParams.assetId} is not supported`,
		);

		const intents: IntentPrimitive[] = [];

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

		const intent = createWithdrawIntentPrimitive({
			assetId: args.withdrawalParams.assetId,
			destinationAddress: args.withdrawalParams.destinationAddress,
			amount: args.withdrawalParams.amount + args.feeEstimation.amount,
			origin: assetInfo.blockchain,
			storageDeposit: args.feeEstimation.quote
				? BigInt(args.feeEstimation.quote.amount_out)
				: 0n,
			transferredTokenFee: args.feeEstimation.amount,
		});

		intents.push(intent);

		return Promise.resolve(intents);
	}

	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		feeEstimation: FeeEstimation;
		logger?: ILogger;
	}): Promise<void> {
		const assetInfo = this.parseAssetId(args.assetId);
		assert(assetInfo !== null, `Asset ${args.assetId} is not supported`);
		const supportedTokens = await this.getCachedSupportedTokens();
		if (!supportedTokens[assetInfo.contractId]) {
			throw new TokenNotSupportedByOmniRelayerError(args.assetId);
		}
		assert(
			args.feeEstimation.amount > 0n,
			`Fee must be greater than zero. Current fee is ${args.feeEstimation.amount}.`,
		);
		return;
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<
			WithdrawalParams,
			"assetId" | "destinationAddress" | "routeConfig"
		>;
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(
			assetInfo !== null,
			`Asset ${args.withdrawalParams.assetId} is not supported`,
		);
		const fee = await this.omniBridgeAPI.getFee(
			omniAddress(ChainKind.Near, configsByEnvironment[this.env].contractID),
			omniAddress(
				caip2ToChainKind(assetInfo.blockchain),
				args.withdrawalParams.destinationAddress,
			),
			omniAddress(ChainKind.Near, assetInfo.contractId),
		);

		assert(
			fee.transferred_token_fee !== null,
			`Asset ${args.withdrawalParams.assetId} is not supported by the relayer`,
		);

		const [minStorageBalance, userStorageBalance] =
			await this.getCachedStorageDepositValue(assetInfo.contractId);
		// Handles the edge case where the omni contract lacks a storage_deposit for the received token.
		// If storage isn't already covered, we pay the required storage_deposit.
		if (minStorageBalance <= userStorageBalance) {
			return {
				amount: BigInt(fee.transferred_token_fee),
				quote: null,
			};
		}

		const feeAmount = minStorageBalance - userStorageBalance;

		const feeQuote = await solverRelay.getQuote({
			quoteParams: {
				defuse_asset_identifier_in: args.withdrawalParams.assetId,
				defuse_asset_identifier_out: NEAR_NATIVE_ASSET_ID,
				exact_amount_out: feeAmount.toString(),
				wait_ms: args.quoteOptions?.waitMs,
			},
			config: {
				baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
				logBalanceSufficient: false,
				logger: args.logger,
			},
		});
		return {
			amount: BigInt(fee.transferred_token_fee) + BigInt(feeQuote.amount_in),
			quote: feeQuote,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		routeConfig: RouteConfig;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	}): Promise<TxInfo | TxNoInfo> {
		return retry(
			async () => {
				if (args.signal?.aborted) {
					throw args.signal.reason;
				}

				const transfer = (
					await this.omniBridgeAPI.findOmniTransfers({
						transaction_id: args.tx.hash,
						offset: args.index,
						limit: 1,
					})
				)[0];
				if (!transfer) throw new OmniTransferNotFoundError(args.tx.hash);
				const destinationChain = getChain(
					transfer.transfer_message.recipient as OmniAddress,
				);
				let txHash = null;
				if (isEvmChain(destinationChain)) {
					txHash = transfer.finalised?.EVMLog?.transaction_hash;
				} else if (destinationChain === ChainKind.Sol) {
					txHash = transfer.finalised?.Solana?.signature;
				} else {
					return { hash: null };
				}
				if (!txHash)
					throw new OmniTransferDestinationChainHashNotFoundError(
						args.tx.hash,
						ChainKind[destinationChain].toLowerCase(),
					);
				return { hash: txHash };
			},
			{
				...(args.retryOptions ?? RETRY_CONFIGS.TWO_MINS_GRADUAL),
				handleError: (err, ctx) => {
					if (
						err instanceof OmniTransferNotFoundError ||
						err === args.signal?.reason
					) {
						ctx.abort();
					}
				},
			},
		);
	}

	/**
	 * Gets storage deposit for a token to avoid frequent RPC calls.
	 * Cache expires after one day using TTL cache.
	 */
	private async getCachedStorageDepositValue(
		contractId: string,
	): Promise<[MinStorageBalance, StorageDepositBalance]> {
		const cached = this.storageDepositCache.get(contractId);
		if (cached != null) {
			return cached;
		}

		const data = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: contractId,
				nearProvider: this.nearProvider,
			}),
			getNearNep141StorageBalance({
				contractId: contractId,
				accountId: OMNI_BRIDGE_CONTRACT,
				nearProvider: this.nearProvider,
			}),
		]);

		this.storageDepositCache.set(contractId, data);

		return data;
	}

	/**
	 * Gets cached tokens supported by the omni relayer, tokens not listed there can't be transferred.
	 * Cache expires after one day using TTL cache.
	 */
	private async getCachedSupportedTokens(): Promise<
		Record<string, OmniAddress>
	> {
		const cached = this.supportedTokensCache.get(
			OmniBridge.SUPPORTED_TOKENS_CACHE_KEY,
		);
		if (cached != null) {
			return cached;
		}

		const data = await this.omniBridgeAPI.getAllowlistedTokens();

		this.supportedTokensCache.set(OmniBridge.SUPPORTED_TOKENS_CACHE_KEY, data);

		return data;
	}
}

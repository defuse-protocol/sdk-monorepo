import {
	assert,
	type ILogger,
	type EnvConfig,
	withTimeout,
} from "@defuse-protocol/internal-utils";
import { type HotBridge as HotSdk, OMNI_HOT_V2 } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
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

export class HotBridge implements Bridge {
	readonly route = RouteEnum.HotBridge;
	protected envConfig: EnvConfig;
	protected hotSdk: HotSdk;
	protected solverRelayApiKey: string | undefined;

	constructor({
		envConfig,
		hotSdk,
		solverRelayApiKey,
	}: { envConfig: EnvConfig; hotSdk: HotSdk; solverRelayApiKey?: string }) {
		this.envConfig = envConfig;
		this.hotSdk = hotSdk;
		this.solverRelayApiKey = solverRelayApiKey;
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
		const nonces = await this.hotSdk.near.parseWithdrawalNonces(
			args.tx.hash,
			args.tx.accountId,
		);

		const nonce = nonces[args.index];
		if (nonce == null) {
			throw new HotWithdrawalNotFoundError(args.tx.hash, args.index);
		}

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
				args.logger?.warn("HOT Bridge incorrect destination tx hash detected", {
					value: status,
				});
				return { status: "completed", txHash: null };
			}
			return {
				status: "completed",
				txHash: formatTxHash(status, args.landingChain),
			};
		}

		return { status: "pending" };
	}
}

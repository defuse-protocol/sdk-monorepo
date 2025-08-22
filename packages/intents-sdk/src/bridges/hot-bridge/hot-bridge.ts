import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	RETRY_CONFIGS,
	type RetryOptions,
} from "@defuse-protocol/internal-utils";
import { type HotBridge as HotSdk, OMNI_HOT_V2 } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
import { retry } from "@lifeomic/attempt";
import {
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
	RouteConfig,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	HotWithdrawalCancelledError,
	HotWithdrawalNotFoundError,
	HotWithdrawalPendingError,
} from "./error";
import { HotWithdrawStatus } from "./hot-bridge-constants";
import {
	formatTxHash,
	getFeeAssetIdForChain,
	hotBlockchainInvariant,
	hotNetworkIdToCAIP2,
	toHotNetworkId,
} from "./hot-bridge-utils";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import { getFeeQuote } from "../../lib/estimate-fee";

export class HotBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected hotSdk: HotSdk;

	constructor({ env, hotSdk }: { env: NearIntentsEnv; hotSdk: HotSdk }) {
		this.env = env;
		this.hotSdk = hotSdk;
	}

	is(routeConfig: RouteConfig): boolean {
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
		let feeAmount: bigint;

		if (args.feeEstimation.quote == null) {
			feeAmount = args.feeEstimation.amount;
		} else {
			feeAmount = BigInt(args.feeEstimation.quote.amount_out);
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
			chain: toHotNetworkId(assetInfo.blockchain),
			token: isNative ? "native" : assetInfo.address,
			amount,
			receiver: args.withdrawalParams.destinationAddress,
			intentAccount: "", // it is not used inside the function
		});

		// Sanity check, in case HOT SDK changes
		assert(intent.amounts[0] === amount.toString(), "Amount is not correct");
		if (intent.amounts.length === 2) {
			assert(
				intent.amounts[1] === feeAmount.toString(),
				"Amount is not correct",
			);
		}

		intents.push(intent as Extract<IntentPrimitive, { intent: "mt_withdraw" }>);

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
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");
		hotBlockchainInvariant(assetInfo.blockchain);

		const { gasPrice: feeAmount } = await this.hotSdk.getGaslessWithdrawFee({
			chain: toHotNetworkId(assetInfo.blockchain),
			token: "native" in assetInfo ? "native" : assetInfo.address,
			receiver: args.withdrawalParams.destinationAddress,
		});

		const feeAssetId = getFeeAssetIdForChain(assetInfo.blockchain);

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId || feeAmount === 0n
				? null
				: await getFeeQuote({
						feeAmount,
						feeAssetId,
						tokenAssetId: args.withdrawalParams.assetId,
						logger: args.logger,
						env: this.env,
						quoteOptions: args.quoteOptions,
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
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
		const nonces = await this.hotSdk.near.parseWithdrawalNonces(
			args.tx.hash,
			args.tx.accountId,
		);

		const nonce = nonces[args.index];
		if (nonce == null) {
			throw new HotWithdrawalNotFoundError(args.tx.hash, args.index);
		}

		return retry(
			async () => {
				if (args.signal?.aborted) {
					throw args.signal.reason;
				}

				const status = await this.hotSdk.getGaslessWithdrawStatus(
					nonce.toString(),
				);

				if (status === HotWithdrawStatus.Canceled) {
					throw new HotWithdrawalCancelledError(args.tx.hash, args.index);
				}
				if (status === HotWithdrawStatus.Completed) {
					return { hash: null };
				}
				if (typeof status === "string") {
					return {
						hash:
							"chain" in args.routeConfig &&
							args.routeConfig.chain !== undefined
								? formatTxHash(status, args.routeConfig.chain)
								: status,
					};
				}

				throw new HotWithdrawalPendingError(args.tx.hash, args.index);
			},
			{
				...(args.retryOptions ?? RETRY_CONFIGS.TWO_MINS_GRADUAL),
				handleError: (err, ctx) => {
					if (
						err instanceof HotWithdrawalCancelledError ||
						err === args.signal?.reason
					) {
						ctx.abort();
					}
				},
			},
		);
	}
}

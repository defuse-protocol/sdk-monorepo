import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	RETRY_CONFIGS,
	type RetryOptions,
	configsByEnvironment,
	utils as internalUtils,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { HotBridge as HotSdk } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
import { retry } from "@lifeomic/attempt";
import {
	TrustlineNotFoundError,
	UnsupportedDestinationMemoError,
} from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
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
		let result = true;

		if ("routeConfig" in params && params.routeConfig != null) {
			result &&= this.is(params.routeConfig);
		}

		try {
			return result && this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = internalUtils.parseDefuseAssetId(assetId);
		if (parsed.contractId === utils.OMNI_HOT_V2) {
			assert(
				parsed.standard === "nep245",
				"NEP-245 is supported only for HOT bridge",
			);
			const [chainId, address] = utils.fromOmni(parsed.tokenId).split(":");
			assert(chainId != null, "Chain ID is not found");
			assert(address != null, "Address is not found");

			return Object.assign(
				parsed,
				{
					blockchain: hotNetworkIdToCAIP2(chainId),
					bridgeName: BridgeNameEnum.Hot,
				},
				(address === "native" ? { native: true } : { address }) as
					| { native: true }
					| { address: string },
			);
		}
		return null;
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

		const { gasPrice: feeAmount } = await this.hotSdk.getGaslessWithdrawFee(
			toHotNetworkId(assetInfo.blockchain),
			args.withdrawalParams.destinationAddress,
		);

		const feeAssetId = getFeeAssetIdForChain(assetInfo.blockchain);

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId || feeAmount === 0n
				? null
				: await solverRelay.getQuote({
						quoteParams: {
							defuse_asset_identifier_in: args.withdrawalParams.assetId,
							defuse_asset_identifier_out: feeAssetId,
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

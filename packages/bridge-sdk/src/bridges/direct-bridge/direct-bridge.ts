import {
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	solverRelay,
	utils,
} from "@defuse-protocol/internal-utils";
import type { providers } from "near-api-js";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { CAIP2_NETWORK } from "../../lib/caip2";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	RouteConfig,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./direct-bridge-constants";
import {
	createWithdrawIntentPrimitive,
	withdrawalParamsInvariant,
} from "./direct-bridge-utils";

export class DirectBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;

	constructor({
		env,
		nearProvider,
	}: { env: NearIntentsEnv; nearProvider: providers.Provider }) {
		this.env = env;
		this.nearProvider = nearProvider;
	}

	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.NearWithdrawal;
	}

	supports(params: Pick<WithdrawalParams, "assetId" | "routeConfig">): boolean {
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
		const parsed = utils.parseDefuseAssetId(assetId);

		if (parsed.standard === "nep141") {
			return Object.assign(parsed, {
				blockchain: CAIP2_NETWORK.Near,
				route: RouteEnum.NearWithdrawal,
				address: parsed.contractId,
			});
		}

		return null;
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		withdrawalParamsInvariant(args.withdrawalParams);

		const intents: IntentPrimitive[] = [];

		if (args.feeEstimation.quote != null) {
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
			amount: args.withdrawalParams.amount,
			storageDeposit: args.feeEstimation.quote
				? BigInt(args.feeEstimation.quote.amount_out)
				: args.feeEstimation.amount,
			msg: args.withdrawalParams.routeConfig?.msg,
		});

		intents.push(intent);

		return Promise.resolve(intents);
	}

	/**
	 * Direct bridge doesn't have minimum withdrawal amount restrictions.
	 */
	async validateMinWithdrawalAmount(_args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void> {
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
		withdrawalParamsInvariant(args.withdrawalParams);

		const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
			args.withdrawalParams.assetId,
		);
		assert(standard === "nep141", "Only NEP-141 is supported");

		if (
			// We don't directly withdraw `wrap.near`, we unwrap it first, so it doesn't require storage
			args.withdrawalParams.assetId === NEAR_NATIVE_ASSET_ID &&
			// Ensure `msg` is not passed, because `native_withdraw` intent doesn't support `msg`
			args.withdrawalParams.routeConfig?.msg === undefined
		)
			return {
				amount: 0n,
				quote: null,
			};

		const [minStorageBalance, userStorageBalance] = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: tokenAccountId,
				nearProvider: this.nearProvider,
			}),
			getNearNep141StorageBalance({
				contractId: tokenAccountId,
				accountId: args.withdrawalParams.destinationAddress,
				nearProvider: this.nearProvider,
			}),
		]);

		if (minStorageBalance <= userStorageBalance) {
			return {
				amount: 0n,
				quote: null,
			};
		}

		const feeAssetId = NEAR_NATIVE_ASSET_ID;
		const feeAmount = minStorageBalance - userStorageBalance;

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId
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
	}): Promise<TxInfo> {
		return { hash: args.tx.hash };
	}
}

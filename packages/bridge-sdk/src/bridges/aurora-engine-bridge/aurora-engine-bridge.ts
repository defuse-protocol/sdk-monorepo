import {
	type NearIntentsEnv,
	configsByEnvironment,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	solverRelay,
	utils,
} from "@defuse-protocol/internal-utils";
import type { providers } from "near-api-js";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import type {
	Bridge,
	BridgeConfig,
	FeeEstimation,
	NearTxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./aurora-engine-bridge-constants";
import {
	createWithdrawIntentPrimitive,
	withdrawalParamsInvariant,
} from "./aurora-engine-bridge-utils";

export class AuroraEngineBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;

	constructor({
		env,
		nearProvider,
	}: { env: NearIntentsEnv; nearProvider: providers.Provider }) {
		this.env = env;
		this.nearProvider = nearProvider;
	}

	is(bridgeConfig: BridgeConfig): boolean {
		return bridgeConfig.bridge === "aurora_engine";
	}

	supports(
		params: Pick<WithdrawalParams, "assetId" | "bridgeConfig">,
	): boolean {
		if ("bridgeConfig" in params && params.bridgeConfig != null) {
			return this.is(params.bridgeConfig);
		}
		return false;
	}

	parseAssetId(): null {
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
			auroraEngineContractId:
				args.withdrawalParams.bridgeConfig.auroraEngineContractId,
			proxyTokenContractId:
				args.withdrawalParams.bridgeConfig.proxyTokenContractId,
			destinationAddress: args.withdrawalParams.destinationAddress,
			amount: args.withdrawalParams.amount,
			storageDeposit: args.feeEstimation.quote
				? BigInt(args.feeEstimation.quote.amount_out)
				: args.feeEstimation.amount,
		});

		intents.push(intent);

		return Promise.resolve(intents);
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<WithdrawalParams, "assetId" | "bridgeConfig">;
		quoteOptions?: { waitMs: number };
	}): Promise<FeeEstimation> {
		withdrawalParamsInvariant(args.withdrawalParams);

		const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
			args.withdrawalParams.assetId,
		);
		assert(standard === "nep141", "Only NEP-141 is supported");

		const [minStorageBalance, userStorageBalance] = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: tokenAccountId,
				nearProvider: this.nearProvider,
			}),
			getNearNep141StorageBalance({
				contractId: tokenAccountId,
				accountId: args.withdrawalParams.bridgeConfig.auroraEngineContractId,
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
						},
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
			quote: feeQuote,
		};
	}

	async waitForWithdrawalCompletion(_args: {
		tx: NearTxInfo;
		index: number;
	}): Promise<TxNoInfo> {
		return { hash: null };
	}
}

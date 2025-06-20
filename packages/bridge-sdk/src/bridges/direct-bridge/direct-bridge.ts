import {
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	solverRelay,
	utils,
} from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { CAIP2_NETWORK } from "../../lib/caip2";
import type {
	Bridge,
	BridgeConfig,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./direct-bridge-constants";
import { createWithdrawIntentPrimitive } from "./direct-bridge-utils";

export class DirectBridge implements Bridge {
	is(bridgeConfig: BridgeConfig) {
		return bridgeConfig.bridge === "direct";
	}

	supports(
		params: Pick<WithdrawalParams, "assetId" | "bridgeConfig">,
	): boolean {
		let result = true;

		if ("bridgeConfig" in params && params.bridgeConfig != null) {
			result &&= this.is(params.bridgeConfig);
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
				bridge: "direct" as const,
				address: parsed.contractId,
			});
		}

		return null;
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]> {
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
			});
		}

		const intent = createWithdrawIntentPrimitive({
			assetId: args.withdrawalParams.assetId,
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
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation> {
		const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
			args.withdrawalParams.assetId,
		);
		assert(standard === "nep141", "Only NEP-141 is supported");

		// We don't directly withdraw `wrap.near`, we unwrap it first, so it doesn't require storage
		if (tokenAccountId === NEAR_NATIVE_ASSET_ID) {
			return {
				amount: 0n,
				quote: null,
			};
		}

		const [minStorageBalance, userStorageBalance] = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: tokenAccountId,
			}),
			getNearNep141StorageBalance({
				contractId: tokenAccountId,
				accountId: args.withdrawalParams.destinationAddress,
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
						},
						config: { logBalanceSufficient: false },
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

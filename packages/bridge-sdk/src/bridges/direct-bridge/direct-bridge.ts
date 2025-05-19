import { getQuote } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/getQuote";
import {
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
} from "@defuse-protocol/defuse-sdk/dist/services/blockchainBalanceService";
import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import { assert } from "../../lib/assert.ts";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types.ts";
import { createWithdrawIntentPrimitive } from "./direct-bridge-utils.ts";

export class DirectBridge implements Bridge {
	supports(params: { bridge: BridgeKind }): boolean {
		return params.bridge === "direct";
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]> {
		return Promise.resolve([
			createWithdrawIntentPrimitive({
				assetId: args.withdrawalParams.assetId,
				destinationAddress: args.withdrawalParams.destinationAddress,
				amount: args.withdrawalParams.amount,
				storageDeposit: args.feeEstimation.quote
					? BigInt(args.feeEstimation.quote.amount_out)
					: args.feeEstimation.amount,
			}),
		]);
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation> {
		const { contractId: tokenAccountId, standard } = parseDefuseAssetId(
			args.withdrawalParams.assetId,
		);
		assert(standard === "nep141", "Only NEP-141 is supported");

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

		const feeAssetId = "nep141:wrap.near";
		const feeAmount = minStorageBalance - userStorageBalance;

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId
				? null
				: await getQuote({
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

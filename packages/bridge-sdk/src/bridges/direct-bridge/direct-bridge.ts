import { getQuote } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/getQuote";
import {
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
} from "@defuse-protocol/defuse-sdk/dist/services/blockchainBalanceService";
import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { CAIP2_NETWORK } from "../../lib/caip2";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";
import { createWithdrawIntentPrimitive } from "./direct-bridge-utils";

export class DirectBridge implements Bridge {
	supports(params: { assetId: string } | { bridge: BridgeKind }): boolean {
		if ("bridge" in params) {
			return params.bridge === "direct";
		}

		try {
			return this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);

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

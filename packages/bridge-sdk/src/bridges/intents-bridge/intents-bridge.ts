import {} from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import type {
	Bridge,
	BridgeConfig,
	FeeEstimation,
	NearTxInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";

export class IntentsBridge implements Bridge {
	is(bridgeConfig: BridgeConfig) {
		return bridgeConfig.bridge === "intents";
	}

	supports(params: Pick<WithdrawalParams, "bridgeConfig">): boolean {
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
	}): Promise<IntentPrimitive[]> {
		const intents: IntentPrimitive[] = [
			{
				intent: "transfer",
				receiver_id: args.withdrawalParams.destinationAddress,
				tokens: {
					[args.withdrawalParams.assetId]:
						args.withdrawalParams.amount.toString(),
				},
			},
		];

		return Promise.resolve(intents);
	}

	async estimateWithdrawalFee(): Promise<FeeEstimation> {
		return {
			amount: 0n,
			quote: null,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo> {
		return { hash: args.tx.hash };
	}
}

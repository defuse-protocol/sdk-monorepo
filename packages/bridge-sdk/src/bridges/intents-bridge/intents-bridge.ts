import type { ILogger } from "@defuse-protocol/internal-utils";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	RouteConfig,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";

export class IntentsBridge implements Bridge {
	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.InternalTransfer;
	}

	supports(params: Pick<WithdrawalParams, "routeConfig">): boolean {
		if ("routeConfig" in params && params.routeConfig != null) {
			return this.is(params.routeConfig);
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

	/**
	 * Intents bridge doesn't have minimum withdrawal amount restrictions.
	 */
	async validateMinWithdrawalAmount(_args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void> {
		return;
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

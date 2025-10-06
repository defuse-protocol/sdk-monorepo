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
import { validateAddress } from "../../lib/validateAddress";
import { Chains } from "../../lib/caip2";
import { InvalidDestinationAddressForWithdrawalError } from "../../classes/errors";

export class IntentsBridge implements Bridge {
	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.InternalTransfer;
	}

	async supports(
		params: Pick<WithdrawalParams, "routeConfig" | "destinationAddress">,
	): Promise<boolean> {
		if ("routeConfig" in params && params.routeConfig != null) {
			const isValid = this.is(params.routeConfig);
			if (
				isValid &&
				validateAddress(params.destinationAddress, Chains.Near) === false
			) {
				throw new InvalidDestinationAddressForWithdrawalError(
					params.destinationAddress,
					"intents-bridge",
					"intents",
				);
			}
			return isValid;
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
	 * Intents bridge doesn't have withdrawal restrictions.
	 */
	async validateWithdrawal(_args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
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

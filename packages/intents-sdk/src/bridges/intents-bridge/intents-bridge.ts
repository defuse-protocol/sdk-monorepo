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
		params: Pick<WithdrawalParams, "routeConfig">,
	): Promise<boolean> {
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
	 * Intents bridge doesn't have withdrawal restrictions.
	 */
	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		logger?: ILogger;
	}): Promise<void> {
		if (validateAddress(args.destinationAddress, Chains.Near) === false) {
			throw new InvalidDestinationAddressForWithdrawalError(
				args.destinationAddress,
				"near-intents",
			);
		}
		return;
	}

	async estimateWithdrawalFee(): Promise<FeeEstimation> {
		return {
			amount: 0n,
			quote: null,
			underlyingFees: {
				[RouteEnum.InternalTransfer]: null,
			},
		};
	}

	async waitForWithdrawalCompletion(args: { tx: NearTxInfo }): Promise<TxInfo> {
		return { hash: args.tx.hash };
	}
}

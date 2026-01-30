import type { ILogger } from "@defuse-protocol/internal-utils";
import { InvalidDestinationAddressForWithdrawalError } from "../../classes/errors";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import { validateAddress } from "../../lib/validateAddress";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	RouteConfig,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalStatus,
} from "../../shared-types";

export class IntentsBridge implements Bridge {
	readonly route = RouteEnum.InternalTransfer;

	private is(routeConfig: RouteConfig) {
		return routeConfig.route === this.route;
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
				memo: args.withdrawalParams.destinationMemo,
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

	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier {
		return {
			landingChain: Chains.Near,
			index: args.index,
			withdrawalParams: args.withdrawalParams,
			tx: args.tx,
		};
	}

	async describeWithdrawal(
		args: WithdrawalIdentifier,
	): Promise<WithdrawalStatus> {
		return { status: "completed", txHash: args.tx.hash };
	}
}

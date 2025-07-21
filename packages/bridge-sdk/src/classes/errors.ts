import { BaseError } from "@defuse-protocol/internal-utils";
import type { FeeEstimation } from "../shared-types";

export type FeeExceedsAmountErrorType = FeeExceedsAmountError & {
	name: "FeeExceedsAmountError";
};

export class FeeExceedsAmountError extends BaseError {
	constructor(
		public feeEstimation: FeeEstimation,
		public amount: bigint,
	) {
		super("Amount too small to pay fee.", {
			metaMessages: [
				`Required fee: ${feeEstimation.amount}`,
				`Withdrawal amount: ${amount}`,
			],
			name: "FeeExceedsAmountError",
		});
	}
}

export type MinWithdrawalAmountErrorType = MinWithdrawalAmountError & {
	name: "MinWithdrawalAmountError";
};

export class MinWithdrawalAmountError extends BaseError {
	constructor(
		public minAmount: bigint,
		public requestedAmount: bigint,
		public assetId: string,
	) {
		super("Withdrawal amount is below minimum required by the bridge.", {
			metaMessages: [
				`Asset ID: ${assetId}`,
				`Minimum amount: ${minAmount}`,
				`Requested amount: ${requestedAmount}`,
			],
			name: "MinWithdrawalAmountError",
		});
	}
}

import { BaseError } from "@defuse-protocol/internal-utils";

export type HotWithdrawalNotFoundErrorType = HotWithdrawalNotFoundError & {
	name: "HotWithdrawalNotFoundError";
};
export class HotWithdrawalNotFoundError extends BaseError {
	constructor(
		public txHash: string,
		public index: number,
	) {
		super("Withdrawal with given index is not found.", {
			metaMessages: [`TxHash: ${txHash}`, `Index: ${index}`],
			name: "HotWithdrawalNotFoundError",
		});
	}
}

export type HotWithdrawalApiFeeRequestTimeoutErrorType =
	HotWithdrawalApiFeeRequestTimeoutError & {
		name: "HotWithdrawalApiFeeRequestTimeoutError";
	};
export class HotWithdrawalApiFeeRequestTimeoutError extends BaseError {
	constructor() {
		super("Hot bridge withdrawal fee request timed out.", {
			name: "HotWithdrawalApiFeeRequestTimeoutError",
		});
	}
}

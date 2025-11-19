import { BaseError } from "@defuse-protocol/internal-utils";

export type HotWithdrawalPendingErrorType = HotWithdrawalPendingError & {
	name: "HotWithdrawalPendingError";
};
export class HotWithdrawalPendingError extends BaseError {
	constructor(
		public txHash: string,
		public index: number,
	) {
		super("Withdrawal is still pending.", {
			metaMessages: [`TxHash: ${txHash}`, `Index: ${index}`],
			name: "HotWithdrawalPendingError",
		});
	}
}

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

export type HotWithdrawalCancelledErrorType = HotWithdrawalCancelledError & {
	name: "HotWithdrawalCancelledError";
};
export class HotWithdrawalCancelledError extends BaseError {
	constructor(
		public txHash: string,
		public index: number,
	) {
		super("Gasless withdrawal was canceled.", {
			metaMessages: [`TxHash: ${txHash}`, `Index: ${index}`],
			name: "HotWithdrawalCancelledError",
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
			name: "HotWithdrawalApiFeeRequestTimeout",
		});
	}
}

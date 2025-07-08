import { BaseError } from "../../errors/base";
import { serialize } from "../../utils/serialize";
import type * as types from "../poaBridgeHttpClient/types";

export type PoaWithdrawalInvariantErrorType = PoaWithdrawalInvariantError & {
	name: "PoaWithdrawalError";
};
export class PoaWithdrawalInvariantError extends BaseError {
	constructor(
		public details: string,
		public result: types.WithdrawalStatusResponseOk["result"],
		public txHash: string,
		public index: number,
	) {
		super("Withdrawal is not in an expected shape.", {
			metaMessages: [
				`TxHash: ${txHash}`,
				`Index: ${index}`,
				`Result: ${serialize(result)}`,
			],
			details,
			name: "PoaWithdrawalInvariant",
		});
	}
}

export type PoaWithdrawalNotFoundErrorType = PoaWithdrawalNotFoundError & {
	name: "PoaWithdrawalNotFoundError";
};
export class PoaWithdrawalNotFoundError extends BaseError {
	constructor(
		public txHash: string,
		public index: number,
		cause: unknown,
	) {
		super("POA withdrawal not found.", {
			metaMessages: [`TxHash: ${txHash}`, `Index: ${index}`],
			name: "PoaWithdrawalNotFoundError",
			cause,
		});
	}
}

export type PoaWithdrawalPendingErrorType = PoaWithdrawalPendingError & {
	name: "PoaWithdrawalPendingError";
};
export class PoaWithdrawalPendingError extends BaseError {
	constructor(
		public result: types.WithdrawalStatusResponseOk["result"],
		public txHash: string,
		public index: number,
	) {
		super("POA withdrawal is still pending.", {
			metaMessages: [
				`TxHash: ${txHash}`,
				`Index: ${index}`,
				`Result: ${serialize(result)}`,
			],
			name: "PoaWithdrawalPendingError",
		});
	}
}

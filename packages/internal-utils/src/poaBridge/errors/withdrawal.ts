import { BaseError } from "../../errors/base";
import { serialize } from "../../utils/serialize";
import type * as types from "../poaBridgeHttpClient/types";
import type { WithdrawalCriteria } from "../waitForWithdrawalCompletion";

export type PoaWithdrawalInvariantErrorType = PoaWithdrawalInvariantError & {
	name: "PoaWithdrawalError";
};
export class PoaWithdrawalInvariantError extends BaseError {
	constructor(
		public details: string,
		public result: types.WithdrawalStatusResponseOk["result"],
		public txHash: string,
		public withdrawalCriteria: WithdrawalCriteria,
	) {
		super("Withdrawal is not in an expected shape.", {
			metaMessages: [
				`TxHash: ${txHash}`,
				`Criteria: ${serialize(withdrawalCriteria)}`,
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
		public withdrawalCriteria: WithdrawalCriteria,
		cause: unknown,
	) {
		super("POA withdrawal not found.", {
			metaMessages: [
				`TxHash: ${txHash}`,
				`Criteria: ${serialize(withdrawalCriteria)}`,
			],
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
		public withdrawalCriteria: WithdrawalCriteria,
	) {
		super("POA withdrawal is still pending.", {
			metaMessages: [
				`TxHash: ${txHash}`,
				`Criteria: ${serialize(withdrawalCriteria)}`,
				`Result: ${serialize(result)}`,
			],
			name: "PoaWithdrawalPendingError",
		});
	}
}

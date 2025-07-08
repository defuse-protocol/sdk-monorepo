import { RpcRequestError } from "../errors/request";
import { assert, type AssertErrorType } from "../utils/assert";
import { wait } from "../utils/wait";
import { getWithdrawalStatus } from "./poaBridgeHttpClient";
import type { types } from "./poaBridgeHttpClient";

export type WaitForWithdrawalCompletionOkType = {
	destinationTxHash: string;
	chain: string;
};
export type WaitForWithdrawalCompletionErrorType =
	| types.JSONRPCErrorType
	| AssertErrorType;

export async function waitForWithdrawalCompletion({
	txHash,
	index = 0,
	signal,
	baseURL,
}: {
	txHash: string;
	index?: number;
	signal: AbortSignal;
	baseURL?: string;
}): Promise<WaitForWithdrawalCompletionOkType> {
	const DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS = 500;

	while (!signal.aborted) {
		const result = await getWithdrawalStatus(
			{ withdrawal_hash: txHash },
			{ baseURL },
		).catch((err) => {
			// WITHDRAWALS_NOT_FOUND error is transient, we should keep retrying
			if (isWithdrawalNotFound(err)) {
				return null;
			}
			throw err;
		});

		if (result != null) {
			const withdrawal = result.withdrawals[index];
			assert(withdrawal, "POA Bridge didn't return withdrawal for given index");

			if (withdrawal.status === "COMPLETED") {
				// COMPLETED should have `transfer_tx_hash` always
				assert(
					withdrawal.data.transfer_tx_hash != null,
					"transfer_tx_hash is null",
				);

				return {
					destinationTxHash: withdrawal.data.transfer_tx_hash,
					chain: withdrawal.data.chain,
				};
			}
		}

		await wait(DEFAULT_WITHDRAWAL_STATUS_INTERVAL_MS);
	}

	throw signal.reason;
}

function isWithdrawalNotFound(err: unknown) {
	const RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND = "Withdrawals not found";
	return (
		err instanceof RpcRequestError &&
		err.details === RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND
	);
}

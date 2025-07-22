import { retry } from "@lifeomic/attempt";
import { BaseError } from "../errors/base";
import {
	HttpRequestError,
	RpcRequestError,
	TimeoutError,
} from "../errors/request";
import type { ILogger } from "../logger";
import { RETRY_CONFIGS, type RetryOptions } from "../utils/retry";
import {
	PoaWithdrawalInvariantError,
	type PoaWithdrawalInvariantErrorType,
	PoaWithdrawalNotFoundError,
	type PoaWithdrawalNotFoundErrorType,
	PoaWithdrawalPendingError,
	type PoaWithdrawalPendingErrorType,
} from "./errors/withdrawal";
import { getWithdrawalStatus } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient/types";

export type WaitForWithdrawalCompletionOkType = {
	destinationTxHash: string;
	chain: string;
};
export type WaitForWithdrawalCompletionErrorType =
	| types.JSONRPCErrorType
	| PoaWithdrawalInvariantErrorType
	| PoaWithdrawalNotFoundErrorType
	| PoaWithdrawalPendingErrorType;

export async function waitForWithdrawalCompletion({
	txHash,
	index = 0,
	signal,
	baseURL,
	retryOptions = RETRY_CONFIGS.TWO_MINS_GRADUAL,
	logger,
}: {
	txHash: string;
	index?: number;
	signal: AbortSignal;
	baseURL?: string;
	retryOptions?: RetryOptions;
	logger?: ILogger;
}): Promise<WaitForWithdrawalCompletionOkType> {
	return retry(
		async () => {
			const result = await getWithdrawalStatus(
				{ withdrawal_hash: txHash },
				{ baseURL, fetchOptions: { signal }, logger },
			);

			const withdrawal = result.withdrawals[index];
			if (withdrawal == null) {
				throw new PoaWithdrawalInvariantError(
					"POA Bridge didn't return withdrawal for given index",
					result,
					txHash,
					index,
				);
			}

			if (withdrawal.status === "COMPLETED") {
				if (withdrawal.data.transfer_tx_hash == null) {
					throw new PoaWithdrawalInvariantError(
						"POA Bridge didn't return transfer_tx_hash for COMPLETED withdrawal",
						result,
						txHash,
						index,
					);
				}

				return {
					destinationTxHash: withdrawal.data.transfer_tx_hash,
					chain: withdrawal.data.chain,
				};
			}

			throw new PoaWithdrawalPendingError(result, txHash, index);
		},
		{
			...retryOptions,
			handleError: (err, context) => {
				if (isWithdrawalNotFound(err)) {
					// WITHDRAWALS_NOT_FOUND error is transient, we should keep retrying
					if (context.attemptsRemaining > 0) {
						return;
					}

					throw new PoaWithdrawalNotFoundError(txHash, index, err);
				}

				// Keep trying PENDING withdrawal
				if (
					err instanceof PoaWithdrawalPendingError &&
					context.attemptsRemaining > 0
				) {
					return;
				}

				// We keep retrying if it is a network error or request timed out
				if (
					err instanceof BaseError &&
					err.walk(
						(err) =>
							err instanceof HttpRequestError ||
							err instanceof TimeoutError ||
							err instanceof RpcRequestError,
					)
				) {
					return;
				}

				context.abort();
			},
		},
	);
}

function isWithdrawalNotFound(err: unknown) {
	const RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND = "Withdrawals not found";
	return (
		err instanceof RpcRequestError &&
		err.details === RPC_ERR_MSG_WITHDRAWALS_NOT_FOUND
	);
}

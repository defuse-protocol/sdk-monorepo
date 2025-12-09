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

export type WithdrawalCriteria = {
	assetId: string;
};

export async function waitForWithdrawalCompletion({
	txHash,
	withdrawalCriteria,
	signal,
	baseURL,
	retryOptions = RETRY_CONFIGS.TWO_MINS_GRADUAL,
	logger,
}: {
	txHash: string;
	withdrawalCriteria: WithdrawalCriteria;
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

			const withdrawal = findMatchingWithdrawal(
				result.withdrawals,
				withdrawalCriteria,
			);
			if (withdrawal == null) {
				throw new PoaWithdrawalInvariantError(
					"POA Bridge didn't return withdrawal matching criteria",
					result,
					txHash,
					withdrawalCriteria,
				);
			}

			if (withdrawal.status === "COMPLETED") {
				if (withdrawal.data.transfer_tx_hash == null) {
					throw new PoaWithdrawalInvariantError(
						"POA Bridge didn't return transfer_tx_hash for COMPLETED withdrawal",
						result,
						txHash,
						withdrawalCriteria,
					);
				}

				return {
					destinationTxHash: withdrawal.data.transfer_tx_hash,
					chain: withdrawal.data.chain,
				};
			}

			throw new PoaWithdrawalPendingError(result, txHash, withdrawalCriteria);
		},
		{
			...retryOptions,
			handleError: (err, context) => {
				if (isWithdrawalNotFound(err)) {
					// WITHDRAWALS_NOT_FOUND error is transient, we should keep retrying
					if (context.attemptsRemaining > 0) {
						return;
					}

					throw new PoaWithdrawalNotFoundError(txHash, withdrawalCriteria, err);
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

/**
 * Finds a withdrawal matching the given criteria.
 *
 * NOTE: Currently only matches by assetId (near_token_id). This means multiple
 * withdrawals of the same token in a single transaction are not supported.
 * POA API doesn't currently support this case either. When support is added,
 * matching could be done by sorting both API results and withdrawal params by
 * amount (fees are equal for same token, so relative ordering is preserved).
 */
function findMatchingWithdrawal(
	withdrawals: types.WithdrawalStatusResponseOk["result"]["withdrawals"],
	criteria: WithdrawalCriteria,
):
	| types.WithdrawalStatusResponseOk["result"]["withdrawals"][number]
	| undefined {
	return withdrawals.find(
		(w) => `nep141:${w.data.near_token_id}` === criteria.assetId,
	);
}

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
	IntentSettlementError,
	type IntentSettlementErrorType,
} from "./errors/intentSettlement";
import * as solverRelayClient from "./solverRelayHttpClient";
import type * as types from "./solverRelayHttpClient/types";

export type WaitForIntentSettlementReturnType = {
	txHash: string;
	intentHash: string;
};

export type WaitForIntentSettlementErrorType =
	| IntentSettlementErrorType
	| types.JSONRPCErrorType;

export async function waitForIntentSettlement({
	intentHash,
	signal,
	baseURL,
	retryOptions = RETRY_CONFIGS.TWO_MINS_GRADUAL,
	logger,
}: {
	intentHash: string;
	signal: AbortSignal;
	baseURL?: string;
	retryOptions?: RetryOptions;
	logger?: ILogger;
}): Promise<WaitForIntentSettlementReturnType> {
	return retry(
		async () => {
			const res = await solverRelayClient.getStatus(
				{ intent_hash: intentHash },
				{ baseURL, fetchOptions: { signal }, logger },
			);

			if (res.status === "SETTLED") {
				return {
					txHash: res.data.hash,
					intentHash: res.intent_hash,
				};
			}

			throw new IntentSettlementError(res);
		},
		{
			...retryOptions,
			handleError: (err, context) => {
				// We keep retrying since we haven't received the necessary status
				if (err instanceof IntentSettlementError) {
					return;
				}

				// We keep retrying if it is a network error or requested timed out
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

import { retry } from "@lifeomic/attempt";
import { BaseError } from "../errors/base";
import {
	HttpRequestError,
	RpcRequestError,
	TimeoutError,
} from "../errors/request";
import type { ILogger } from "../logger";
import type { RetryOptions } from "../utils/retry";
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

export type IntentSettlementCallbacks = {
	/** Fires once when tx hash first becomes available */
	onTxHashKnown?: (txHash: string) => void;
};

/**
 * Aggressive retry for status polling (expects 3 changes in ~1.5s, ~500ms each)
 *
 * - initialDelay (250ms): Skip period where status never changes
 * - delay (200ms) + factor (1.15): Fast polling first 2.5s (<400ms intervals),
 *   then exponential backoff for edge cases
 * - maxAttempts (15): ~10s total coverage
 * - jitter: Prevents simultaneous requests from multiple clients
 */
const aggressiveRetryOptions = {
	initialDelay: 250,
	delay: 200,
	minDelay: 200,
	factor: 1.15,
	maxAttempts: 15,
	jitter: true,
} satisfies RetryOptions;

export async function waitForIntentSettlement({
	intentHash,
	signal,
	baseURL,
	retryOptions = aggressiveRetryOptions,
	logger,
	solverRelayApiKey,
	...events
}: {
	intentHash: string;
	signal: AbortSignal;
	baseURL?: string;
	retryOptions?: RetryOptions;
	logger?: ILogger;
	solverRelayApiKey?: string;
} & IntentSettlementCallbacks): Promise<WaitForIntentSettlementReturnType> {
	let txHashEmitted = false;

	return retry(
		async () => {
			const res = await solverRelayClient.getStatus(
				{ intent_hash: intentHash },
				{ baseURL, fetchOptions: { signal }, logger, solverRelayApiKey },
			);

			// Emit tx hash once when first known
			if (
				!txHashEmitted &&
				(res.status === "TX_BROADCASTED" || res.status === "SETTLED")
			) {
				txHashEmitted = true;
				events.onTxHashKnown?.(res.data.hash);
			}

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

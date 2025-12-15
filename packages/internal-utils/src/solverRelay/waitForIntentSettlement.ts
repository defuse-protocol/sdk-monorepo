import { BaseError } from "../errors/base";
import {
	HttpRequestError,
	RpcRequestError,
	TimeoutError,
} from "../errors/request";
import type { ILogger } from "../logger";
import { poll, POLL_PENDING, type CompletionStats } from "../utils/poll";
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
 * Default timing stats for intent settlement based on production data.
 * Polls aggressively early, backs off for outliers.
 */
const DEFAULT_SETTLEMENT_STATS: CompletionStats = {
	p50: 2_000,
	p90: 10_000,
	p99: 356_000,
};

export async function waitForIntentSettlement({
	intentHash,
	signal,
	baseURL,
	logger,
	solverRelayApiKey,
	...events
}: {
	intentHash: string;
	signal?: AbortSignal;
	baseURL?: string;
	logger?: ILogger;
	solverRelayApiKey?: string;
} & IntentSettlementCallbacks): Promise<WaitForIntentSettlementReturnType> {
	let txHashEmitted = false;

	return poll(
		async () => {
			try {
				const res = await solverRelayClient.getStatus(
					{ intent_hash: intentHash },
					{
						baseURL,
						fetchOptions: { signal },
						logger,
						solverRelayApiKey,
					},
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

				// Not settled yet - continue polling
				return POLL_PENDING;
			} catch (err: unknown) {
				if (isTransientError(err)) {
					return POLL_PENDING;
				}
				throw err;
			}
		},
		{ stats: DEFAULT_SETTLEMENT_STATS, signal },
	);
}

function isTransientError(err: unknown): boolean {
	if (err instanceof IntentSettlementError) {
		return true;
	}

	if (
		err instanceof BaseError &&
		err.walk(
			(err) =>
				err instanceof HttpRequestError ||
				err instanceof TimeoutError ||
				err instanceof RpcRequestError,
		)
	) {
		return true;
	}

	return false;
}

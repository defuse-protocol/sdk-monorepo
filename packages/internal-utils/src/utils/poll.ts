import { BaseError } from "../errors/base";

const PHASE = {
	HOT: "HOT",
	COOLING: "COOLING",
	COLD: "COLD",
} as const;

type Phase = (typeof PHASE)[keyof typeof PHASE];

const DEFAULT_INTERVALS: Record<Phase, number> = {
	[PHASE.HOT]: 1_000,
	[PHASE.COOLING]: 3_000,
	[PHASE.COLD]: 10_000,
};

/**
 * Sentinel value to signal that polling should continue.
 * Return this from the poll function to indicate "not done yet".
 */
export const POLL_PENDING = Symbol("poll.pending");

export type PollTimeoutErrorType = PollTimeoutError & {
	name: "PollTimeoutError";
};

export class PollTimeoutError extends BaseError {
	override name = "PollTimeoutError" as const;

	constructor(
		public elapsedMs: number,
		public timeoutMs: number,
	) {
		super("Polling timed out", {
			details: `Operation did not complete within ${timeoutMs}ms (elapsed: ${elapsedMs}ms)`,
		});
	}
}

export interface CompletionStats {
	/** 50th percentile (median completion time in ms) */
	p50: number;
	/** 90th percentile (in ms) */
	p90: number;
	/** 99th percentile - hard timeout (in ms) */
	p99: number;
}

export interface PollOptions {
	stats: CompletionStats;
	signal?: AbortSignal;
	/** Minimum interval floor (default: 1000ms) */
	minInterval?: number;
	/** Maximum interval ceiling (default: 30000ms) */
	maxInterval?: number;
}

/**
 * Polls a function using latency-optimized intervals.
 *
 * Polls aggressively early (when completion is most likely), backs off later
 * for outliers. Optimized for latency-sensitive operations like swaps.
 *
 * Interval strategy:
 * - 0 → p50: HOT (1s) - most completions happen here (~50%)
 * - p50 → p90: COOLING (3s) - moderate polling (~40%)
 * - p90 → p99: COLD (10s) - back off for outliers (~9%)
 *
 * @param fn - Function to poll. Return POLL_PENDING to continue, any other value to complete.
 * @param options - Polling configuration with completion stats
 * @returns The resolved value from fn
 * @throws PollTimeoutError when p99 is exceeded
 * @throws AbortError when signal is aborted
 */
export async function poll<T>(
	fn: () => Promise<T | typeof POLL_PENDING>,
	options: PollOptions,
): Promise<T> {
	const { stats, signal, minInterval = 1000, maxInterval = 30_000 } = options;
	const { p50, p90, p99 } = stats;

	const startTime = performance.now();

	while (true) {
		signal?.throwIfAborted();

		const elapsed = performance.now() - startTime;

		if (elapsed >= p99) {
			throw new PollTimeoutError(elapsed, p99);
		}

		const result = await fn();
		if (result !== POLL_PENDING) {
			return result;
		}

		const phase = getPhase(elapsed, p50, p90);
		const rawInterval = DEFAULT_INTERVALS[phase];
		const interval = clamp(rawInterval, minInterval, maxInterval);

		await sleep(interval, signal);
	}
}

function getPhase(elapsed: number, p50: number, p90: number): Phase {
	if (elapsed < p50) return PHASE.HOT;
	if (elapsed < p90) return PHASE.COOLING;
	return PHASE.COLD;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason);
			return;
		}

		const timeoutId = setTimeout(resolve, ms);

		const abortHandler = () => {
			clearTimeout(timeoutId);
			reject(signal?.reason);
		};

		signal?.addEventListener("abort", abortHandler, { once: true });
	});
}

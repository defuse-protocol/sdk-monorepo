import {
	calculateMaxAttempts,
	type RetryOptions,
	RETRY_CONFIGS,
} from "@defuse-protocol/internal-utils";
import { WITHDRAWAL_P99_BY_CHAIN } from "../constants/withdrawal-timing";
import type { Chain } from "../lib/caip2";

const BASE_DELAY = 2000;
const DELAY_FACTOR = 1.3;

/**
 * Timeout multiplier applied to p99 timing.
 *
 * Using p99 * 1.5 as timeout threshold. Trade-offs considered:
 * - p99 alone: ~1% of healthy withdrawals would timeout, generating false alerts
 * - p99 * 1.5: reduces false positives while still detecting real issues reasonably fast
 * - p99 * 2.0: very few false alerts but delayed incident detection
 *
 * Since timeouts trigger error reports (not retries), we prioritize reducing
 * false alerts over faster incident detection.
 */
const TIMEOUT_MULTIPLIER = 1.5;

/**
 * Returns retry options optimized for the given destination chain.
 * Uses p99 timing data with a buffer to calculate appropriate timeout and attempts.
 * Falls back to TWO_HOURS_PERSISTENT for unknown chains.
 */
export function getRetryOptionsForChain(caip2: Chain): RetryOptions {
	const p99 = WITHDRAWAL_P99_BY_CHAIN[caip2];

	if (p99 == null) {
		return RETRY_CONFIGS.TWO_HOURS_PERSISTENT;
	}

	const timeoutMs = p99 * TIMEOUT_MULTIPLIER * 1000;

	const maxAttempts = calculateMaxAttempts(timeoutMs, BASE_DELAY, DELAY_FACTOR);

	return {
		delay: BASE_DELAY,
		factor: DELAY_FACTOR,
		maxAttempts,
	};
}

/**
 * Configuration for deadline validation
 */
export interface DeadlineConfig {
	/** Maximum allowed deadline (ms) for exact_in quotes */
	maxDeadlineExactInMs: number;
	/** Maximum allowed deadline (ms) for exact_out quotes (typically larger) */
	maxDeadlineExactOutMs: number;
}

/**
 * Default deadline configuration values
 */
export const DEFAULT_DEADLINE_CONFIG: DeadlineConfig = {
	maxDeadlineExactInMs: 120_000, // 2 minutes
	maxDeadlineExactOutMs: 1_200_000, // 20 minutes (10x for exact_out)
};
/**
 * Check if the requested deadline exceeds the maximum allowed.
 *
 * Exact-out quotes typically allow larger deadlines because they require
 * more complex execution paths.
 *
 * @param minDeadlineMs - The requested minimum deadline in milliseconds
 * @param isExactIn - Whether this is an exact_in quote (vs exact_out)
 * @param config - Deadline configuration (optional, uses defaults)
 * @returns true if the deadline is too large
 */
export function isDeadlineTooLarge(
	minDeadlineMs: number,
	isExactIn: boolean,
	config: DeadlineConfig = DEFAULT_DEADLINE_CONFIG,
): boolean {
	const maxDeadline = isExactIn
		? config.maxDeadlineExactInMs
		: config.maxDeadlineExactOutMs;

	return minDeadlineMs > maxDeadline;
}

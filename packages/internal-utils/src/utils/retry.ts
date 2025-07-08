import type { AttemptOptions } from "@lifeomic/attempt";

export type RetryOptions = Partial<
	Pick<
		AttemptOptions<unknown>,
		| "delay"
		| "initialDelay"
		| "minDelay"
		| "maxDelay"
		| "factor"
		| "maxAttempts"
		| "timeout"
		| "jitter"
		| "initialJitter"
	>
>;

export const RETRY_CONFIGS = {
	// Quick operations - API calls, database queries
	THIRTY_SECS_AGGRESSIVE: {
		delay: 500,
		minDelay: 500,
		factor: 2,
		maxAttempts: 6,
		jitter: true,
	},
	// Fast services - payment processing, real-time operations
	ONE_MIN_MODERATE: {
		delay: 1000,
		minDelay: 1000,
		factor: 1.5,
		maxAttempts: 8,
		jitter: true,
	},
	// Standard operations - withdrawals, transfers
	TWO_MINS_GRADUAL: {
		delay: 500,
		minDelay: 500,
		factor: 1.5,
		maxAttempts: 12,
		jitter: true,
	},
	// Medium persistence - file processing, reports
	FIVE_MINS_STEADY: {
		delay: 2000,
		minDelay: 2000,
		factor: 1.4,
		maxAttempts: 12,
		jitter: true,
	},
	// Long-running operations - batch jobs, imports
	THIRTY_MINS_PATIENT: {
		delay: 5000,
		minDelay: 5000,
		factor: 1.3,
		maxAttempts: 18,
		jitter: true,
	},
	// Very long operations - large data migrations, system sync
	TWO_HOURS_PERSISTENT: {
		delay: 10000,
		minDelay: 10000,
		factor: 1.2,
		maxAttempts: 27,
		jitter: true,
	},
};

/**
 * @returns how many tries happen before totalDelay ≥ timeout
 */
export function calculateMaxAttempts(
	// Max amount of time we're willing to wait
	timeout: number,
	// Wait time between retries
	delay: number,
	factor: number,
): number {
	let totalDelay = 0;
	let currentDelay = delay;
	let attempts = 1;

	while (totalDelay + currentDelay <= timeout) {
		totalDelay += currentDelay;
		attempts++;
		currentDelay *= factor;
	}

	return Math.max(1, attempts);
}

if (import.meta.vitest) {
	const { expect, test } = import.meta.vitest;

	test("returns ~max attempts", () => {
		expect(calculateMaxAttempts(0, 500, 1.5)).toEqual(1);
		expect(calculateMaxAttempts(200, 500, 1.5)).toEqual(1);
		expect(calculateMaxAttempts(500, 500, 1.5)).toEqual(2);
		expect(calculateMaxAttempts(1000, 500, 2)).toEqual(2);
		expect(calculateMaxAttempts(1500, 500, 2)).toEqual(3);
		expect(calculateMaxAttempts(750, 500, 1.5)).toEqual(2);
		expect(calculateMaxAttempts(800, 500, 1.5)).toEqual(2);
		expect(calculateMaxAttempts(2 * 60 * 60 * 1000, 500, 1.5)).toEqual(22);
	});
}

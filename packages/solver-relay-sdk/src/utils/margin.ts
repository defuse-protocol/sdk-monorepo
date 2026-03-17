/**
 * Configuration for margin calculation
 */
export interface MarginConfig {
	/** Minimum deadline threshold (ms) - below this, use minMargin */
	deadlineMinMs: number;
	/** Maximum deadline threshold (ms) - above this, use maxMargin */
	deadlineMaxMs: number;
	/** Minimum margin multiplier */
	marginMin: number;
	/** Maximum margin multiplier */
	marginMax: number;
}

/**
 * Default margin configuration values
 */
export const DEFAULT_MARGIN_CONFIG: MarginConfig = {
	deadlineMinMs: 20_000, // 20 seconds
	deadlineMaxMs: 120_000, // 2 minutes
	marginMin: 1,
	marginMax: 3,
};

/**
 * Calculate margin multiplier based on deadline.
 *
 * Uses linear interpolation between minMargin and maxMargin based on
 * where the deadline falls between deadlineMinMs and deadlineMaxMs.
 *
 * @param deadlineMs - The deadline in milliseconds
 * @param config - Margin configuration (optional, uses defaults)
 * @returns The calculated margin multiplier, rounded to 3 decimal places
 */
export function calculateMargin(
	deadlineMs: number,
	config: MarginConfig = DEFAULT_MARGIN_CONFIG,
): number {
	const { deadlineMinMs, deadlineMaxMs, marginMin, marginMax } = config;

	if (deadlineMs <= deadlineMinMs) {
		return Number.parseFloat(marginMin.toFixed(3));
	}

	if (deadlineMs >= deadlineMaxMs) {
		return Number.parseFloat(marginMax.toFixed(3));
	}

	const scalingFactor =
		(deadlineMs - deadlineMinMs) / (deadlineMaxMs - deadlineMinMs);
	const margin = marginMin + scalingFactor * (marginMax - marginMin);

	return Number.parseFloat(margin.toFixed(3));
}

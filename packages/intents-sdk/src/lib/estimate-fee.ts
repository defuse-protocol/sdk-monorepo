import {
	configsByEnvironment,
	type ILogger,
	type NearIntentsEnv,
	QuoteError,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import { tokens } from "./tokensUsdPricesHttpClient";
import type { FeeEstimation, QuoteOptions, UnderlyingFees } from "../shared-types";

/**
 * Helper to extract a specific fee from FeeEstimation's underlyingFees.
 * Throws if the route's fee object doesn't exist (invariant: bridges must populate their fees during estimation).
 * Returns the fee value which may be undefined for optional fees within the route object.
 *
 * @example
 * ```typescript
 * const relayerFee = getUnderlyingFee(feeEstimation, RouteEnum.HotBridge, 'relayerFee');
 * const storageDepositFee = getUnderlyingFee(feeEstimation, RouteEnum.OmniBridge, 'storageDepositFee');
 * ```
 * @throws {Error} If the route's fee object is not found in underlyingFees
 */
export function getUnderlyingFee<
	R extends keyof UnderlyingFees,
	K extends keyof NonNullable<UnderlyingFees[R]>,
>(
	feeEstimation: FeeEstimation,
	route: R,
	feeKey: K,
): NonNullable<UnderlyingFees[R]>[K] {
	const routeFees = feeEstimation.underlyingFees?.[route];
	if (routeFees === undefined) {
		throw new Error(
			`Missing underlying fees for route "${String(route)}". Fee estimation must populate underlyingFees before creating withdrawal intents.`,
		);
	}
	return (routeFees as NonNullable<UnderlyingFees[R]>)[feeKey];
}

/**
 * ExactIn fallback with 1.2x multiplier
 */
export async function getFeeQuote({
	feeAmount,
	feeAssetId,
	tokenAssetId,
	quoteOptions,
	env,
	logger,
	solverRelayApiKey,
}: {
	feeAmount: bigint;
	feeAssetId: string;
	tokenAssetId: string;
	quoteOptions?: QuoteOptions;
	env: NearIntentsEnv;
	logger?: ILogger;
	solverRelayApiKey?: string;
}): Promise<solverRelay.Quote> {
	try {
		return await solverRelay.getQuote({
			quoteParams: {
				defuse_asset_identifier_in: tokenAssetId,
				defuse_asset_identifier_out: feeAssetId,
				exact_amount_out: feeAmount.toString(),
				wait_ms: quoteOptions?.waitMs,
				min_wait_ms: quoteOptions?.minWaitMs,
				max_wait_ms: quoteOptions?.maxWaitMs,
				trusted_metadata: quoteOptions?.trustedMetadata,
			},
			config: {
				baseURL: configsByEnvironment[env].solverRelayBaseURL,
				logBalanceSufficient: false,
				logger: logger,
				solverRelayApiKey,
			},
		});
	} catch (err: unknown) {
		if (!(err instanceof QuoteError)) {
			throw err;
		}

		logger?.info(
			"Can't get exact out quote, trying to get exact in quote with x1.2",
		);

		const prices = await tokens({ env });
		const feeAssetPrice = prices.items.find(
			(t) => t.defuse_asset_id === feeAssetId,
		);
		const tokenAssetPrice = prices.items.find(
			(t) => t.defuse_asset_id === tokenAssetId,
		);

		if (feeAssetPrice == null || tokenAssetPrice == null) {
			throw err;
		}

		// Precision-safe computation using fixed-point BigInt
		// Scale USD prices to 1e6 (micro-dollars) for stable integer math
		const USD_SCALE = 1_000_000; // 1e6
		const feePriceScaled = BigInt(Math.round(feeAssetPrice.price * USD_SCALE));
		const tokenPriceScaled = BigInt(
			Math.round(tokenAssetPrice.price * USD_SCALE),
		);
		const feeDecimals = BigInt(feeAssetPrice.decimals);
		const tokenDecimals = BigInt(tokenAssetPrice.decimals);

		// ceil( feeAmount * feePrice / 10^feeDecimals / tokenPrice * 10^tokenDecimals * 1.2 )
		const num = feeAmount * feePriceScaled * 12n * 10n ** tokenDecimals;
		const den = tokenPriceScaled * 10n ** feeDecimals * 10n;
		let exactAmountIn = num / den;
		if (num % den !== 0n) exactAmountIn += 1n; // ceil

		// Avoid sending 0 to the solver
		if (exactAmountIn === 0n) exactAmountIn = 1n;

		const quote = await solverRelay.getQuote({
			quoteParams: {
				defuse_asset_identifier_in: tokenAssetId,
				defuse_asset_identifier_out: feeAssetId,
				exact_amount_in: exactAmountIn.toString(),
				wait_ms: quoteOptions?.waitMs,
				min_wait_ms: quoteOptions?.minWaitMs,
				max_wait_ms: quoteOptions?.maxWaitMs,
				trusted_metadata: quoteOptions?.trustedMetadata,
			},
			config: {
				baseURL: configsByEnvironment[env].solverRelayBaseURL,
				logBalanceSufficient: false,
				logger: logger,
				solverRelayApiKey,
			},
		});

		// Check if the quote is reasonable (should be around 1.2x due to our buffer)
		// Use BigInt arithmetic with scaling to get precise ratio
		const RATIO_SCALE = 1000n; // Scale by 1000 for 3 decimal precision
		const actualRatio = (BigInt(quote.amount_out) * RATIO_SCALE) / feeAmount;
		const actualRatioNumber = Number(actualRatio) / Number(RATIO_SCALE);

		if (actualRatio > 1500n) {
			// 1.5x with scaling
			logger?.warn(
				`Quote amount_out ratio is too high: ${actualRatioNumber.toFixed(2)}x`,
			);
			throw err;
		}

		if (BigInt(quote.amount_out) < feeAmount) {
			logger?.warn("Quote amount_out is less than feeAmount");
			throw err;
		}
		return quote;
	}
}

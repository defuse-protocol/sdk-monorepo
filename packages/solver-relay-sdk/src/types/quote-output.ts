import { type QuoteOutput, QuoteOutputType } from "./wire.js";

type SuccessOpts = { amount_out: string } | { amount_in: string };

interface NoLiquidityOpts {
	amount_out?: string;
	time_to_liquidity_ms?: number;
}

interface InsufficientAmountOpts {
	min_amount?: string;
}

export const QuoteOutputFactory = {
	success(opts: SuccessOpts): QuoteOutput {
		return { ...opts };
	},

	noLiquidity(opts?: NoLiquidityOpts): QuoteOutput {
		return { ...opts, type: QuoteOutputType.NO_LIQUIDITY };
	},

	insufficientAmount(opts?: InsufficientAmountOpts): QuoteOutput {
		return { ...opts, type: QuoteOutputType.INSUFFICIENT_AMOUNT };
	},

	unsupportedTokens(): QuoteOutput {
		return { type: QuoteOutputType.UNSUPPORTED_TOKENS };
	},

	sameToken(): QuoteOutput {
		return { type: QuoteOutputType.SAME_TOKEN };
	},

	unexpectedError(): QuoteOutput {
		return { type: QuoteOutputType.UNEXPECTED_ERROR };
	},

	deadlineExceeded(): QuoteOutput {
		return { type: QuoteOutputType.DEADLINE_EXCEEDED };
	},

	priceDifferenceTooLarge(): QuoteOutput {
		return { type: QuoteOutputType.PRICE_DIFFERENCE_TOO_LARGE };
	},

	marketLimit(): QuoteOutput {
		return { type: QuoteOutputType.MARKET_LIMIT };
	},

	staleData(): QuoteOutput {
		return { type: QuoteOutputType.STALE_DATA };
	},
} as const;

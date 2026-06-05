import type { ILogger } from "../logger";
import { assert } from "../utils/assert";
import { QuoteError } from "./errors/quote";
import type { quote } from "./solverRelayHttpClient";
import type {
	FailedQuote,
	JSONRPCErrorType,
	Quote,
} from "./solverRelayHttpClient/types";
import { quoteWithLog } from "./utils/quoteWithLog";

export type GetQuoteParams = {
	quoteParams: Parameters<typeof quoteWithLog>[0];
	config: Parameters<typeof quoteWithLog>[1];
};

export type GetQuoteReturnType = Quote;

export type GetQuoteErrorType = QuoteError | JSONRPCErrorType;

export async function getQuote(
	params: GetQuoteParams,
): Promise<GetQuoteReturnType> {
	const result = await quoteWithLog(params.quoteParams, {
		// If we don't set timeout, then 10s quote will fail, since the default timeout is 10s.
		timeout: (params.quoteParams?.wait_ms ?? 0) + 10000,
		...params.config,
	});
	return handleQuoteResult(result, params.quoteParams, params.config.logger);
}

function handleQuoteResult(
	result: Awaited<ReturnType<typeof quote>>,
	quoteParams: GetQuoteParams["quoteParams"],
	logger?: ILogger,
) {
	if (result == null) {
		throw new QuoteError({
			quote: null,
			quoteParams,
		});
	}

	const failedQuotes: FailedQuote[] = [];
	const validQuotes: Quote[] = [];
	for (const q of result) {
		if (!isValidQuote(q)) {
			failedQuotes.push(q);
			continue;
		}

		// The relay aggregates quotes from independent solvers, so a buggy or
		// malicious solver can echo back tokens we never requested. Acting on
		// such a quote would make the user swap the wrong assets, so drop it
		// (it is neither a usable quote nor an INSUFFICIENT_AMOUNT failure).
		if (!matchesRequestedTokens(q, quoteParams)) {
			logger?.warn("quote: dropping quote with mismatched tokens", {
				quoteParams,
				quote: q,
			});
			continue;
		}

		validQuotes.push(q);
	}

	const hasExactIn = quoteParams.exact_amount_in != null;
	const hasExactOut = quoteParams.exact_amount_out != null;
	assert(
		hasExactIn !== hasExactOut,
		`Invalid quoteParams: exactly one of exact_amount_in or exact_amount_out must be set (got exact_amount_in=${quoteParams.exact_amount_in}, exact_amount_out=${quoteParams.exact_amount_out}).`,
	);
	const quoteKind = hasExactIn ? "exact_in" : "exact_out";
	const bestQuote = sortQuotes(validQuotes, quoteKind)[0];
	if (bestQuote != null) {
		return bestQuote;
	}

	const failedQuote = failedQuotes[0];
	if (failedQuote != null) {
		throw new QuoteError({
			quote: failedQuote,
			quoteParams,
		});
	}

	throw new QuoteError({
		quote: null,
		quoteParams,
	});
}

function sortQuotes(
	quotes: Quote[],
	quoteKind: "exact_in" | "exact_out",
): Quote[] {
	return quotes.slice().sort((a, b) => {
		if (quoteKind === "exact_in") {
			// For exact_in, sort by `amount_out` in descending order
			if (BigInt(a.amount_out) > BigInt(b.amount_out)) return -1;
			if (BigInt(a.amount_out) < BigInt(b.amount_out)) return 1;
			return 0;
		}

		// For exact_out, sort by `amount_in` in ascending order
		if (BigInt(a.amount_in) < BigInt(b.amount_in)) return -1;
		if (BigInt(a.amount_in) > BigInt(b.amount_in)) return 1;
		return 0;
	});
}

function isValidQuote(quote: Quote | FailedQuote): quote is Quote {
	return !("type" in quote);
}

function matchesRequestedTokens(
	quote: Quote,
	quoteParams: GetQuoteParams["quoteParams"],
): boolean {
	return (
		quote.defuse_asset_identifier_in ===
			quoteParams.defuse_asset_identifier_in &&
		quote.defuse_asset_identifier_out ===
			quoteParams.defuse_asset_identifier_out
	);
}

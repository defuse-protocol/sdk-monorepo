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
	const result = await quoteWithLog(params.quoteParams, params.config);
	return handleQuoteResult(result, params.quoteParams);
}

function handleQuoteResult(
	result: Awaited<ReturnType<typeof quote>>,
	quoteParams: GetQuoteParams["quoteParams"],
) {
	if (result == null) {
		throw new QuoteError({
			quote: null,
			quoteParams,
		});
	}

	const failedQuotes: FailedQuote[] = [];
	const validQuotes = [];
	for (const q of result) {
		if (isValidQuote(q)) {
			validQuotes.push(q);
		} else {
			failedQuotes.push(q);
		}
	}

	const quoteKind =
		quoteParams.exact_amount_in !== null ? "exact_in" : "exact_out";
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

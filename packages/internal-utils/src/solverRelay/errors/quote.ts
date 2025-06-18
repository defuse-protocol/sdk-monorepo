import { BaseError } from "../../errors/base";
import { serialize } from "../../utils/serialize";
import type { quote as quote_ } from "../solverRelayHttpClient";
import type { FailedQuote } from "../solverRelayHttpClient/types";

export class QuoteError extends BaseError {
	quote: FailedQuote | null;
	quoteParams: Parameters<typeof quote_>[0];

	constructor({
		quote,
		quoteParams,
	}: {
		quote: FailedQuote | null;
		quoteParams: Parameters<typeof quote_>[0];
	}) {
		super("Quote error", {
			details: quote == null ? "NO_QUOTE" : quote.type,
			metaMessages: [
				`Quote: ${serialize(quote)}`,
				`Quote params: ${serialize(quoteParams)}`,
			],
			name: "QuoteError",
		});

		this.quote = quote;
		this.quoteParams = quoteParams;
	}
}

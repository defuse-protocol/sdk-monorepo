import { describe, expect, it } from "vitest";
import { QuoteOutputFactory } from "./quote-output.js";
import { QuoteOutputType } from "./wire.js";

describe("QuoteOutputFactory", () => {
	describe("success", () => {
		it("creates output with amount_out", () => {
			const result = QuoteOutputFactory.success({ amount_out: "1000" });
			expect(result).toEqual({ amount_out: "1000" });
		});

		it("creates output with amount_in", () => {
			const result = QuoteOutputFactory.success({ amount_in: "500" });
			expect(result).toEqual({ amount_in: "500" });
		});
	});

	describe("noLiquidity", () => {
		it("creates output with type only", () => {
			const result = QuoteOutputFactory.noLiquidity();
			expect(result).toEqual({ type: QuoteOutputType.NO_LIQUIDITY });
		});

		it("creates output with optional fields", () => {
			const result = QuoteOutputFactory.noLiquidity({
				amount_out: "1000",
				time_to_liquidity_ms: 5000,
			});
			expect(result).toEqual({
				amount_out: "1000",
				time_to_liquidity_ms: 5000,
				type: QuoteOutputType.NO_LIQUIDITY,
			});
		});
	});

	describe("insufficientAmount", () => {
		it("creates output with type only", () => {
			const result = QuoteOutputFactory.insufficientAmount();
			expect(result).toEqual({ type: QuoteOutputType.INSUFFICIENT_AMOUNT });
		});

		it("creates output with min_amount", () => {
			const result = QuoteOutputFactory.insufficientAmount({
				min_amount: "100",
			});
			expect(result).toEqual({
				min_amount: "100",
				type: QuoteOutputType.INSUFFICIENT_AMOUNT,
			});
		});
	});

	describe("error factories", () => {
		it("creates unsupportedTokens", () => {
			expect(QuoteOutputFactory.unsupportedTokens()).toEqual({
				type: QuoteOutputType.UNSUPPORTED_TOKENS,
			});
		});

		it("creates sameToken", () => {
			expect(QuoteOutputFactory.sameToken()).toEqual({
				type: QuoteOutputType.SAME_TOKEN,
			});
		});

		it("creates unexpectedError", () => {
			expect(QuoteOutputFactory.unexpectedError()).toEqual({
				type: QuoteOutputType.UNEXPECTED_ERROR,
			});
		});

		it("creates deadlineExceeded", () => {
			expect(QuoteOutputFactory.deadlineExceeded()).toEqual({
				type: QuoteOutputType.DEADLINE_EXCEEDED,
			});
		});

		it("creates priceDifferenceTooLarge", () => {
			expect(QuoteOutputFactory.priceDifferenceTooLarge()).toEqual({
				type: QuoteOutputType.PRICE_DIFFERENCE_TOO_LARGE,
			});
		});

		it("creates marketLimit", () => {
			expect(QuoteOutputFactory.marketLimit()).toEqual({
				type: QuoteOutputType.MARKET_LIMIT,
			});
		});

		it("creates staleData", () => {
			expect(QuoteOutputFactory.staleData()).toEqual({
				type: QuoteOutputType.STALE_DATA,
			});
		});
	});
});

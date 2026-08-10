import { describe, expect, it, vi } from "vitest";
import { AssertionError } from "../errors/assert";
import { QuoteError } from "./errors/quote";
import { getQuote } from "./getQuote";
import type { Quote } from "./solverRelayHttpClient/types";
import * as quoteWithLogModule from "./utils/quoteWithLog";

vi.mock("./utils/quoteWithLog", () => ({
	quoteWithLog: vi.fn(),
}));

const baseParams = {
	defuse_asset_identifier_in:
		"nep245:v2_1.omni.hot.tg:56_2CMMyVTGZkeyNZTSvS5sarzfir6g",
	defuse_asset_identifier_out:
		"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
	wait_ms: undefined,
	min_wait_ms: undefined,
	max_wait_ms: undefined,
	trusted_metadata: undefined,
};

const config = { logBalanceSufficient: false };

const validQuote: Quote = {
	quote_hash: "hash1",
	defuse_asset_identifier_in: baseParams.defuse_asset_identifier_in,
	defuse_asset_identifier_out: baseParams.defuse_asset_identifier_out,
	amount_in: "1000000000000",
	amount_out: "26000000000000",
	expiration_time: new Date(Date.now() + 60_000).toISOString(),
};

describe("getQuote() exact_amount validation", () => {
	it("returns quote when only exact_amount_out is set", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			validQuote,
		]);

		const result = await getQuote({
			quoteParams: { ...baseParams, exact_amount_out: "26000000000000" },
			config,
		});

		expect(result).toEqual(validQuote);
	});

	it("returns quote when only exact_amount_in is set", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			validQuote,
		]);

		const result = await getQuote({
			quoteParams: { ...baseParams, exact_amount_in: "1000000000000" },
			config,
		});

		expect(result).toEqual(validQuote);
	});

	it("throws AssertionError with values when both exact_amount_in and exact_amount_out are set", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			validQuote,
		]);

		const error = await getQuote({
			// @ts-expect-error - intentionally invalid: both fields set to test runtime guard
			quoteParams: {
				...baseParams,
				exact_amount_in: "1000000000000",
				exact_amount_out: "26000000000000",
			},
			config,
		}).catch((e) => e);

		expect(error).toBeInstanceOf(AssertionError);
		expect(error.message).toContain(
			"exact_amount_in=1000000000000, exact_amount_out=26000000000000",
		);
	});

	it("throws AssertionError with values when neither exact_amount_in nor exact_amount_out is set", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			validQuote,
		]);

		const error = await getQuote({
			// @ts-expect-error - intentionally invalid: neither field set to test runtime guard
			quoteParams: baseParams,
			config,
		}).catch((e) => e);

		expect(error).toBeInstanceOf(AssertionError);
		expect(error.message).toContain(
			"exact_amount_in=undefined, exact_amount_out=undefined",
		);
	});
});

describe("getQuote() request verification", () => {
	const mismatchedTokenQuote: Quote = {
		...validQuote,
		quote_hash: "hash-mismatch-token",
		// Solver echoed back a different output token than requested,
		// while offering a more attractive amount_out.
		defuse_asset_identifier_out: "nep245:v2_1.omni.hot.tg:56_other_token",
		amount_out: "99000000000000",
	};

	it("ignores a higher-ranked quote whose tokens differ from the request", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			mismatchedTokenQuote,
			validQuote,
		]);

		const result = await getQuote({
			quoteParams: { ...baseParams, exact_amount_in: "1000000000000" },
			config,
		});

		expect(result).toEqual(validQuote);
	});

	it("ignores an exact_in quote whose amount_in differs from the request", async () => {
		// Solver only fills half the requested input but advertises a huge output.
		const wrongAmountInQuote: Quote = {
			...validQuote,
			quote_hash: "hash-wrong-amount-in",
			amount_in: "500000000000",
			amount_out: "99000000000000",
		};
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			wrongAmountInQuote,
			validQuote,
		]);

		const result = await getQuote({
			quoteParams: { ...baseParams, exact_amount_in: "1000000000000" },
			config,
		});

		expect(result).toEqual(validQuote);
	});

	it("throws QuoteError when every quote fails to match the request", async () => {
		vi.mocked(quoteWithLogModule.quoteWithLog).mockResolvedValueOnce([
			mismatchedTokenQuote,
		]);

		const error = await getQuote({
			quoteParams: { ...baseParams, exact_amount_in: "1000000000000" },
			config,
		}).catch((e) => e);

		expect(error).toBeInstanceOf(QuoteError);
	});
});

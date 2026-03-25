import { describe, expect, it, vi } from "vitest";
import { AssertionError } from "../errors/assert";
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

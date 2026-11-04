import {
	configsByEnvironment,
	QuoteError,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import { describe, expect, it, vi } from "vitest";
import { RouteEnum } from "../constants/route-enum";
import type { FeeEstimation } from "../shared-types";
import { getFeeQuote, getUnderlyingFee } from "./estimate-fee";
import { tokens } from "./tokensUsdPricesHttpClient";

vi.mock("@defuse-protocol/internal-utils", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@defuse-protocol/internal-utils")>();

	return {
		...actual,
		solverRelay: { ...actual.solverRelay, getQuote: vi.fn() },
	};
});

vi.mock("./tokensUsdPricesHttpClient", () => ({ tokens: vi.fn() }));

describe("getUnderlyingFee", () => {
	it("returns the fee value when route exists", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {
				[RouteEnum.HotBridge]: {
					relayerFee: 50n,
					blockNumber: 0n,
				},
			},
		};

		const result = getUnderlyingFee(
			feeEstimation,
			RouteEnum.HotBridge,
			"relayerFee",
		);

		expect(result).toBe(50n);
	});

	it("returns undefined for optional fee when route exists", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {
				[RouteEnum.PoaBridge]: {
					relayerFee: 100n,
				},
			},
		};

		const result = getUnderlyingFee(
			feeEstimation,
			RouteEnum.PoaBridge,
			// @ts-expect-error - We consciously read the incorrect key
			"storageDepositFee",
		);

		expect(result).toBeUndefined();
	});

	it("throws when route fees are missing", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {},
		};

		expect(() =>
			getUnderlyingFee(feeEstimation, RouteEnum.HotBridge, "relayerFee"),
		).toThrow('Missing underlying fees for route "hot_bridge"');
	});

	it("throws when underlyingFees is undefined", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			// @ts-expect-error - We consciously build an invalid object
			underlyingFees: undefined,
		};

		expect(() =>
			// @ts-expect-error - We consciously read the incorrect key
			getUnderlyingFee(feeEstimation, RouteEnum.PoaBridge, "bridgeFee"),
		).toThrow('Missing underlying fees for route "poa_bridge"');
	});
});

describe("getFeeQuote", () => {
	const feeAssetId = "nep141:wrap.near";
	const tokenAssetId = "nep141:blackdragon.tkn.near";
	const feeAmount = 1_250_000_000_000_000_000_000n; // 0.00125 NEAR

	function priceInfo(defuseAssetId: string, price: number) {
		return {
			defuse_asset_id: defuseAssetId,
			decimals: 24,
			blockchain: "near",
			symbol: "",
			price,
			price_updated_at: "",
			contract_address: "",
		};
	}

	function mockExactOutQuoteFailure() {
		const exactOutError = new QuoteError({
			quote: null,
			quoteParams: {
				defuse_asset_identifier_in: tokenAssetId,
				defuse_asset_identifier_out: feeAssetId,
				exact_amount_out: feeAmount.toString(),
			},
		});
		vi.mocked(solverRelay.getQuote).mockReset();
		vi.mocked(solverRelay.getQuote).mockRejectedValueOnce(exactOutError);
		return exactOutError;
	}

	it("falls back to an exact in quote for a token priced below $0.0000005", async () => {
		mockExactOutQuoteFailure();
		vi.mocked(solverRelay.getQuote).mockImplementationOnce(
			async ({ quoteParams }) => ({
				quote_hash: "hash",
				defuse_asset_identifier_in: tokenAssetId,
				defuse_asset_identifier_out: feeAssetId,
				amount_in: quoteParams.exact_amount_in ?? "0",
				amount_out: ((feeAmount * 12n) / 10n).toString(),
				expiration_time: "",
			}),
		);
		vi.mocked(tokens).mockResolvedValue({
			items: [priceInfo(feeAssetId, 2.5), priceInfo(tokenAssetId, 9.279e-9)],
			skip: 0,
			take: 2,
			total: 2,
		});

		const quote = await getFeeQuote({
			feeAmount,
			feeAssetId,
			tokenAssetId,
			envConfig: configsByEnvironment.production,
		});

		// 0.00125 NEAR * $2.5 / $0.000000009279 * 1.2 = ~404,138.5 BLACKDRAGON
		const amountIn = BigInt(quote.amount_in);
		expect(amountIn / 10n ** 24n).toBe(404_138n);
	});

	it("rethrows the quote error when the token has no usable price", async () => {
		const exactOutError = mockExactOutQuoteFailure();
		vi.mocked(tokens).mockResolvedValue({
			items: [priceInfo(feeAssetId, 2.5), priceInfo(tokenAssetId, 0)],
			skip: 0,
			take: 2,
			total: 2,
		});

		await expect(
			getFeeQuote({
				feeAmount,
				feeAssetId,
				tokenAssetId,
				envConfig: configsByEnvironment.production,
			}),
		).rejects.toBe(exactOutError);
	});
});

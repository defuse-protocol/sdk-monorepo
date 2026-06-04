import { describe, expect, it } from "vitest";
import {
	type OneClickQuoteResponse,
	type OneClickQuoteRequest,
	verifyQuoteSignature,
} from "./quote-signature";

const quoteResponse: OneClickQuoteResponse = {
	quote: {
		amountIn: "1000000000000000000000000000",
		amountInFormatted: "1000.0",
		amountInUsd: "2360.0000",
		minAmountIn: "990000000000000000000000000",
		amountOut: "999000000000000000000000000",
		amountOutFormatted: "999.0",
		amountOutUsd: "2357.6400",
		minAmountOut: "989010000000000000000000000",
		timeEstimate: 20,
		refundFee: "0",
		withdrawFee: "0",
		deadline: "2027-01-15T13:50:06.704Z",
		timeWhenInactive: "2027-01-15T13:50:06.704Z",
		depositAddress:
			"20998d8471f5aeb4f04d14c69f2b228348212b031d524a001c4e28f237d593e8",
	},
	quoteRequest: {
		dry: false,
		depositMode: "SIMPLE",
		swapType: "FLEX_INPUT",
		slippageTolerance: 100,
		originAsset: "nep141:wrap.near",
		depositType: "ORIGIN_CHAIN",
		destinationAsset: "nep141:wrap.near",
		amount: "1000000000000000000000000000",
		refundTo: "test.near",
		refundType: "ORIGIN_CHAIN",
		recipient: "test.near",
		recipientType: "DESTINATION_CHAIN",
		deadline: "2027-01-12T13:50:06.704Z",
		confidentiality: "public",
		referral: "test",
		quoteWaitingTimeMs: 0,
		appFees: [
			{
				recipient:
					"5880ad2b362620fadf759cbceb1cd5737ce8c6ed7fb8e9942881e6731f9247dd",
				fee: 10,
			},
		],
	},
	signature:
		"ed25519:2VMJbqbmkYrRwKqsm9WKZqustmzstAx7TFeBmtSBdM5s7VMT3vbwrq64AgmbE8KFJvRJX21mMqYzmd3VgjegwFcd",
	timestamp: "2026-06-04T10:23:21.079Z",
	correlationId: "0f41830b-ce99-4ac9-a659-809a35ff2fd9",
};

const quoteRequest: OneClickQuoteRequest = {
	dry: false,
	depositMode: "SIMPLE",
	swapType: "FLEX_INPUT",
	slippageTolerance: 100,
	originAsset: "nep141:wrap.near",
	depositType: "ORIGIN_CHAIN",
	destinationAsset: "nep141:wrap.near",
	amount: "1000000000000000000000000000",
	refundTo: "test.near",
	refundType: "ORIGIN_CHAIN",
	recipient: "test.near",
	recipientType: "DESTINATION_CHAIN",
	referral: "test",
	deadline: "2027-01-12T13:50:06.704Z",
};

describe("1Click quote signature", () => {
	it("verifies a live quote signature", async () => {
		const response = await fetch("https://1click.chaindefuser.com/v0/quote", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(quoteRequest),
		});

		expect(response.ok).toBe(true);

		const responseBody: OneClickQuoteResponse = await response.json();

		expect(verifyQuoteSignature(responseBody)).toBe(true);
	});

	it("verifies a valid quote signature", () => {
		expect(verifyQuoteSignature(quoteResponse)).toBe(true);
	});

	it("rejects a quote modified after signing", () => {
		const modifiedQuote = {
			...quoteResponse,
			quote: {
				...quoteResponse.quote,
				amountOut: "407479",
			},
		};

		expect(verifyQuoteSignature(modifiedQuote)).toBe(false);
	});
});

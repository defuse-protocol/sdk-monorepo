import { describe, expect, it } from "vitest";
import {
	type OneClickQuoteResponse,
	type OneClickQuoteRequest,
	buildSignedQuote,
	buildSignedQuoteRequest,
	quoteHash,
	verifyQuoteSignature,
} from "./quote-signature";

const quoteResponse: OneClickQuoteResponse = {
	quote: {
		amountIn: "1000000000000000000000000000",
		amountInFormatted: "1000.0",
		amountInUsd: "3050.0000",
		minAmountIn: "990000000000000000000000000",
		amountOut: "999000000000000000000000000",
		amountOutFormatted: "999.0",
		amountOutUsd: "3046.9500",
		minAmountOut: "989010000000000000000000000",
		timeEstimate: 20,
		refundFee: "0",
		withdrawFee: "0",
		deadline: "2027-01-15T13:50:06.704Z",
		timeWhenInactive: "2027-01-15T13:50:06.704Z",
		depositAddress:
			"d471820bf8d9ae73dce04990f4a8606a492e9053ae66cfa5d20e48d3eb12ac2e",
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
		refundTo: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
		refundType: "ORIGIN_CHAIN",
		recipient: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
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
		"ed25519:2tP661MVuFS885kvCUJbxGJTZqoeV1ekro9SV2LVQmox5FYdDbPQctXMzfdP56rSeUsshXHWP7636CQwL2iRLjhr",
	timestamp: "2026-06-03T15:26:55.692Z",
	correlationId: "8b295da9-e42d-4f7d-8639-3cd8baec9530",
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
	refundTo: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
	refundType: "ORIGIN_CHAIN",
	recipient: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
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

	it("hashes the server signed fields", () => {
		expect(quoteHash(quoteResponse)).toBe(
			"25oXZLUeTs49qWMtgSUdFDT2Xn1wQGtfvW8mW7J9qYbB",
		);
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

	it("excludes unsigned response-only fields from the signed payload", () => {
		expect(buildSignedQuote(quoteResponse)).toEqual({
			amountIn: "1000000000000000000000000000",
			amountInFormatted: "1000.0",
			amountInUsd: "3050.0000",
			minAmountIn: "990000000000000000000000000",
			amountOut: "999000000000000000000000000",
			amountOutFormatted: "999.0",
			amountOutUsd: "3046.9500",
			minAmountOut: "989010000000000000000000000",
		});
		expect(buildSignedQuoteRequest(quoteResponse)).toEqual({
			dry: false,
			swapType: "FLEX_INPUT",
			slippageTolerance: 100,
			originAsset: "nep141:wrap.near",
			depositType: "ORIGIN_CHAIN",
			destinationAsset: "nep141:wrap.near",
			amount: "1000000000000000000000000000",
			refundTo: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
			refundType: "ORIGIN_CHAIN",
			recipient: "0x0b424406b6cbe4e22a26dd19c2a8156ea19d9329",
			recipientType: "DESTINATION_CHAIN",
			deadline: "2027-01-12T13:50:06.704Z",
			quoteWaitingTimeMs: undefined,
			referral: "test",
			virtualChainRecipient: undefined,
			virtualChainRefundRecipient: undefined,
			customRecipientMsg: undefined,
			sessionId: undefined,
			connectedWallets: undefined,
			correlationId: undefined,
			appFees: undefined,
			partnerId: undefined,
			userAccountId: undefined,
			depositMode: undefined,
		});
	});
});

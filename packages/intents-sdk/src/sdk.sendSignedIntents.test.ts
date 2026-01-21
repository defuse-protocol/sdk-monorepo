import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import { IntentsSDK } from "./sdk";
import type { MultiPayload } from "./intents/shared-types";

describe("sdk.sendSignedIntents()", () => {
	it("sends single pre-signed intent", async () => {
		const { sdk, intentRelayer } = setupMocks();
		noPublish(intentRelayer);

		const multiPayload: MultiPayload = {
			payload: "test-payload-1",
			signature: "test-signature-1",
			standard: "erc191",
		};

		void sdk.sendSignedIntents({ multiPayloads: [multiPayload] });

		await vi.waitFor(() =>
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce(),
		);
		expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
			{
				multiPayloads: [multiPayload],
				quoteHashes: [],
			},
			expect.any(Object),
		);
	});

	it("sends multiple pre-signed intents", async () => {
		const { sdk, intentRelayer } = setupMocks();
		noPublish(intentRelayer);

		const multiPayloads: MultiPayload[] = [
			{ payload: "payload-1", signature: "sig-1", standard: "erc191" },
			{ payload: "payload-2", signature: "sig-2", standard: "erc191" },
			{ payload: "payload-3", signature: "sig-3", standard: "erc191" },
		];

		void sdk.sendSignedIntents({ multiPayloads });

		await vi.waitFor(() =>
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce(),
		);
		expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
			{
				multiPayloads,
				quoteHashes: [],
			},
			expect.any(Object),
		);
	});

	it("returns correct tickets", async () => {
		const { sdk, intentRelayer } = setupMocks();
		const expectedTickets = ["hash-1", "hash-2"];
		vi.mocked(intentRelayer.publishIntents).mockResolvedValueOnce(
			expectedTickets,
		);

		const result = await sdk.sendSignedIntents({
			multiPayloads: [
				{ payload: "p1", signature: "s1", standard: "erc191" },
				{ payload: "p2", signature: "s2", standard: "erc191" },
			],
		});

		expect(result.tickets).toEqual(expectedTickets);
	});

	it("passes quoteHashes to relayer", async () => {
		const { sdk, intentRelayer } = setupMocks();
		noPublish(intentRelayer);

		const quoteHashes = ["quote-hash-1", "quote-hash-2"];

		void sdk.sendSignedIntents({
			multiPayloads: [{ payload: "p", signature: "s", standard: "erc191" }],
			quoteHashes,
		});

		await vi.waitFor(() =>
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce(),
		);
		expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
			expect.objectContaining({ quoteHashes }),
			expect.any(Object),
		);
	});
});

function setupMocks() {
	const intentRelayer = new IntentRelayerPublic({ env: "production" });
	vi.spyOn(intentRelayer, "publishIntents");

	class MockSDK extends IntentsSDK {
		constructor(...args: ConstructorParameters<typeof IntentsSDK>) {
			super(...args);
			this.intentRelayer = intentRelayer;
		}
	}

	const sdk = new MockSDK({ referral: "" });

	return { sdk, intentRelayer };
}

function noPublish(intentRelayer: IntentRelayerPublic) {
	vi.mocked(intentRelayer.publishIntents).mockImplementation(
		async () => new Promise(() => {}),
	);
}

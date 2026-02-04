import { describe, expect, it } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { IntentSignerViem } from "./intent-signer-viem";

describe("IntentSignerViem", () => {
	const account = privateKeyToAccount(generatePrivateKey());
	const signer = new IntentSignerViem({ signer: account });

	describe("signRaw()", () => {
		it("returns MultiPayloadErc191 with correct structure", async () => {
			const result = await signer.signRaw({ payload: "test message" });

			expect(result).toMatchObject({
				standard: "erc191",
				payload: "test message",
			});
			expect(result.signature).toMatch(/^secp256k1:/);
		});

		it("preserves payload exactly as provided", async () => {
			const payload = '{"foo":"bar","nested":{"value":123}}';
			const result = await signer.signRaw({ payload });

			expect(result.payload).toBe(payload);
		});
	});

	describe("signIntent()", () => {
		it("returns MultiPayloadErc191 with JSON-serialized intent", async () => {
			const result = await signer.signIntent({
				signer_id: "test.near",
				verifying_contract: "intents.near",
				deadline: "2025-01-01T00:00:00.000Z",
				nonce: "dGVzdG5vbmNl",
				intents: [],
			});

			expect(result.standard).toBe("erc191");
			expect(result.signature).toMatch(/^secp256k1:/);

			const parsed = JSON.parse(result.payload);
			expect(parsed).toEqual({
				signer_id: "test.near",
				verifying_contract: "intents.near",
				deadline: "2025-01-01T00:00:00.000Z",
				nonce: "dGVzdG5vbmNl",
				intents: [],
			});
		});
	});

	it("has standard property set to erc191", () => {
		expect(signer.standard).toBe("erc191");
	});
});

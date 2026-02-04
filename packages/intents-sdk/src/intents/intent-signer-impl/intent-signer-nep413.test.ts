import { base64 } from "@scure/base";
import { describe, expect, it, vi } from "vitest";
import { IntentSignerNEP413 } from "./intent-signer-nep413";

describe("IntentSignerNEP413", () => {
	const mockPublicKey = "ed25519:6TupyNrcHGTt5XRLmHTc2KGaiSbjhQi1KHtCXTgbcr4Y";
	const mockSignature = base64.encode(new Uint8Array(64).fill(1));

	const createSigner = () => {
		const signMessage = vi.fn().mockResolvedValue({
			publicKey: mockPublicKey,
			signature: mockSignature,
		});

		const signer = new IntentSignerNEP413({
			signMessage,
			accountId: "test.near",
		});

		return { signer, signMessage };
	};

	describe("signRaw()", () => {
		it("returns MultiPayloadNep413 with correct structure", async () => {
			const { signer } = createSigner();
			const nonce = base64.encode(new Uint8Array(32).fill(42));

			const result = await signer.signRaw({
				payload: {
					message: "test message",
					nonce,
					recipient: "app.near",
				},
			});

			expect(result).toMatchObject({
				standard: "nep413",
				payload: {
					message: "test message",
					nonce,
					recipient: "app.near",
				},
				public_key: mockPublicKey,
			});
			expect(result.signature).toMatch(/^ed25519:/);
		});

		it("calls signMessage with NEP413Payload and hash", async () => {
			const { signer, signMessage } = createSigner();
			const nonce = base64.encode(new Uint8Array(32).fill(42));

			await signer.signRaw({
				payload: {
					message: "test",
					nonce,
					recipient: "app.near",
				},
			});

			expect(signMessage).toHaveBeenCalledOnce();
			// biome-ignore lint/style/noNonNullAssertion: asserted above
			const [nep413Payload, hash] = signMessage.mock.calls[0]!;

			expect(nep413Payload).toMatchObject({
				message: "test",
				recipient: "app.near",
			});
			expect(nep413Payload.nonce).toHaveLength(32);
			expect(hash).toBeInstanceOf(Uint8Array);
			expect(hash).toHaveLength(32);
		});

		it("preserves callbackUrl if provided", async () => {
			const { signer } = createSigner();
			const nonce = base64.encode(new Uint8Array(32).fill(42));

			const result = await signer.signRaw({
				payload: {
					message: "test",
					nonce,
					recipient: "app.near",
					callbackUrl: "https://example.com/callback",
				},
			});

			expect(result.payload.callbackUrl).toBe("https://example.com/callback");
		});
	});

	describe("signIntent()", () => {
		it("returns MultiPayloadNep413 with JSON-serialized message", async () => {
			const { signer } = createSigner();
			const nonce = base64.encode(new Uint8Array(32).fill(42));

			const result = await signer.signIntent({
				signer_id: "user.near",
				verifying_contract: "intents.near",
				deadline: "2025-01-01T00:00:00.000Z",
				nonce,
				intents: [],
			});

			expect(result.standard).toBe("nep413");
			expect(result.payload.recipient).toBe("intents.near");
			expect(result.payload.nonce).toBe(nonce);

			const message = JSON.parse(result.payload.message);
			expect(message).toEqual({
				signer_id: "user.near",
				deadline: "2025-01-01T00:00:00.000Z",
				intents: [],
			});
		});

		it("uses accountId when signer_id not provided", async () => {
			const { signer } = createSigner();
			const nonce = base64.encode(new Uint8Array(32).fill(42));

			const result = await signer.signIntent({
				signer_id: undefined,
				verifying_contract: "intents.near",
				deadline: "2025-01-01T00:00:00.000Z",
				nonce,
				intents: [],
			});

			const message = JSON.parse(result.payload.message);
			expect(message.signer_id).toBe("test.near");
		});
	});

	it("has standard property set to nep413", () => {
		const { signer } = createSigner();
		expect(signer.standard).toBe("nep413");
	});
});

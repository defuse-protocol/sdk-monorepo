import { describe, expect, it } from "vitest";
import {
	MultiPayloadValidator,
	MultiPayloadNarrowedValidator,
} from "./validate.js";

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

// NEP413 message has a narrower format - without nonce/verifying_contract
// because those are part of the outer Nep413Payload wrapper
const validNep413Message = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	signer_id: "bob.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

describe("MultiPayloadNarrowedValidator", () => {
	it("parses and validates erc191 variant", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value).toEqual({
			standard: "erc191",
			payload: {
				original: validDefusePayload,
				parsed: JSON.parse(validDefusePayload),
			},
		});
	});

	it("parses and validates nep413 variant", () => {
		const input = {
			standard: "nep413",
			payload: {
				message: validNep413Message,
				nonce: "dGVzdG5vbmNl",
				recipient: "defuse.near",
			},
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		const payload = result.value.payload as { message: unknown };
		expect(payload.message).toEqual({
			original: validNep413Message,
			parsed: JSON.parse(validNep413Message),
		});
	});

	it("parses and validates ton_connect text variant", () => {
		const input = {
			standard: "ton_connect",
			payload: {
				type: "text",
				text: validDefusePayload,
			},
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		const payload = result.value.payload as { text: unknown };
		expect(payload.text).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("does not modify original input", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		MultiPayloadNarrowedValidator.validate(input);
		expect(input.payload).toBe(validDefusePayload);
	});

	it("rejects extra properties", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
			signature: "should not be here",
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
		expect(result.issues?.length).toBeGreaterThan(0);
	});

	it("rejects invalid payload", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("returns issue for non-serializable input", () => {
		const input = {
			standard: "erc191",
			payload: BigInt(123),
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toContain("BigInt");
	});

	it("exposes schema", () => {
		expect(MultiPayloadNarrowedValidator.schema).toBeDefined();
		expect(typeof MultiPayloadNarrowedValidator.schema).toBe("object");
	});

	it("implements Standard Schema interface", () => {
		expect(MultiPayloadNarrowedValidator["~standard"].version).toBe(1);
		expect(MultiPayloadNarrowedValidator["~standard"].vendor).toBe("ajv");
		expect(typeof MultiPayloadNarrowedValidator["~standard"].validate).toBe(
			"function",
		);
	});
});

describe("MultiPayloadValidator", () => {
	it("parses and validates JSON payload for erc191", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value.payload).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("rejects invalid JSON payload", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("rejects invalid DefusePayload structure", () => {
		const input = {
			standard: "erc191",
			payload: JSON.stringify({ invalid: "structure" }),
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});
});

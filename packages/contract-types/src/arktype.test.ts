import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { MultiPayloadNarrowedValidator } from "./validate.js";
import type { Validator } from "./standard-schema.js";

// ========== WRAPPER (copy to your codebase) ==========
// Wraps a Defuse validator for use with ArkType.
function toArkTypeSchema<I, O>(validator: Validator<I, O>) {
	return type("unknown")
		.narrow((val, ctx) => {
			const result = validator.validate(val);
			if (result.issues) {
				return ctx.mustBe(result.issues[0]?.message ?? "Validation failed");
			}
			return true;
		})
		.pipe((val) => {
			const result = validator.validate(val);
			if (result.issues) {
				throw new Error("Unreachable: narrow should have caught this");
			}
			return result.value;
		});
}

// Usage:
const payloadSchema = toArkTypeSchema(MultiPayloadNarrowedValidator);
// =====================================================

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

function isArkTypeError(
	result: unknown,
): result is { readonly summary: string } {
	return typeof result === "object" && result !== null && "summary" in result;
}

describe("toArkTypeSchema wrapper", () => {
	it("validates and transforms with JSON parsing", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = payloadSchema(input);
		if (isArkTypeError(result)) {
			throw new Error(`Validation failed: ${result.summary}`);
		}
		if (result.standard === "erc191") {
			// Type narrowing: result.payload is now { original: string; parsed: DefusePayloadFor_DefuseIntents }
			expect(result.payload.original).toBe(validDefusePayload);
			expect(result.payload.parsed.signer_id).toBe("bob.near");
		}
	});

	it("rejects invalid payload with error message", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
		};

		const result = payloadSchema(input);
		expect(isArkTypeError(result)).toBe(true);
		if (isArkTypeError(result)) {
			expect(result.summary).toBeDefined();
			expect(result.summary.length).toBeGreaterThan(0);
		}
	});

	it("works in composite schema", () => {
		const requestSchema = type({
			id: "string",
			timestamp: "number",
			payload: payloadSchema,
		});

		const input = {
			id: "req-123",
			timestamp: Date.now(),
			payload: {
				standard: "erc191",
				payload: validDefusePayload,
			},
		};

		const result = requestSchema(input);
		if (isArkTypeError(result)) {
			throw new Error(`Validation failed: ${result.summary}`);
		}
		expect(result.id).toBe("req-123");
		if (result.payload.standard === "erc191") {
			// Type narrowing works through nested objects
			expect(result.payload.payload.original).toBe(validDefusePayload);
		}
	});

	it("rejects when outer schema fails", () => {
		const requestSchema = type({
			id: "string",
			timestamp: "number",
			payload: payloadSchema,
		});

		const input = {
			id: 123,
			timestamp: Date.now(),
			payload: {
				standard: "erc191",
				payload: validDefusePayload,
			},
		};

		const result = requestSchema(input);
		expect(isArkTypeError(result)).toBe(true);
	});
});

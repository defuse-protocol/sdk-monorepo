import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { MultiPayloadNarrowedValidator } from "./validate.js";
import type { Validator, ValidationResult } from "./standard-schema.js";

// ========== WRAPPER (copy to your codebase) ==========
// Wraps a Defuse validator for use with Valibot.
function toValibotSchema<I, O>(
	validator: Validator<I, O>,
): v.GenericSchema<I, O> {
	let lastResult: ValidationResult<O> | undefined;
	return v.pipe(
		v.unknown(),
		v.rawCheck((ctx) => {
			lastResult = validator.validate(ctx.dataset.value);
			if (lastResult.issues) {
				for (const issue of lastResult.issues) {
					ctx.addIssue({ message: issue.message });
				}
			}
		}),
		v.rawTransform(() => {
			if (!lastResult || lastResult.issues) {
				throw new Error("Unreachable: rawCheck should have caught this");
			}
			return lastResult.value;
		}),
	) as v.GenericSchema<I, O>;
}

// Usage:
const payloadSchema = toValibotSchema(MultiPayloadNarrowedValidator);
// =====================================================

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

describe("toValibotSchema wrapper", () => {
	it("validates and transforms with JSON parsing", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = v.safeParse(payloadSchema, input);
		expect(result.success).toBe(true);
		if (result.success && result.output.standard === "erc191") {
			// Type narrowing: result.output.payload is now { original: string; parsed: DefusePayloadFor_DefuseIntents }
			expect(result.output.payload.original).toBe(validDefusePayload);
			expect(result.output.payload.parsed.signer_id).toBe("bob.near");
		}
	});

	it("rejects invalid payload with error message", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
		};

		const result = v.safeParse(payloadSchema, input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues[0]?.message).toBeDefined();
		}
	});

	it("works in composite schema", () => {
		const requestSchema = v.object({
			id: v.string(),
			timestamp: v.number(),
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

		const result = v.safeParse(requestSchema, input);
		expect(result.success).toBe(true);
		if (result.success && result.output.payload.standard === "erc191") {
			expect(result.output.id).toBe("req-123");
			// Type narrowing works through nested objects
			expect(result.output.payload.payload.original).toBe(validDefusePayload);
		}
	});

	it("rejects when outer schema fails", () => {
		const requestSchema = v.object({
			id: v.string(),
			timestamp: v.number(),
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

		const result = v.safeParse(requestSchema, input);
		expect(result.success).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MultiPayloadNarrowedValidator } from "./validate.js";
import { MultiPayloadNarrowedSchema } from "./type-check-schemas.js";
import type { MultiPayloadNarrowed } from "./index.js";
import type { Validator, ValidationResult } from "./standard-schema.js";

// ========== OPTION 1: z.fromJSONSchema (experimental) ==========
// Does NOT parse inner JSON strings - validates raw structure only.
const schemaFromJSON = z.fromJSONSchema(
	MultiPayloadNarrowedSchema as z.core.JSONSchema.JSONSchema,
) as z.ZodType<MultiPayloadNarrowed, MultiPayloadNarrowed>;

// ========== OPTION 2: WRAPPER (copy to your codebase) ==========
// Wraps a Defuse validator for use with Zod. Supports JSON parsing.
function toZodSchema<I, O>(validator: Validator<I, O>) {
	let lastResult: ValidationResult<O> | undefined;
	return z
		.unknown()
		.superRefine((val, ctx) => {
			lastResult = validator.validate(val);
			if (lastResult.issues) {
				for (const issue of lastResult.issues) {
					ctx.addIssue({ code: "custom", message: issue.message });
				}
			}
		})
		.transform(() => {
			if (!lastResult || lastResult.issues) {
				throw new Error("Unreachable: superRefine should have caught this");
			}
			return lastResult.value;
		}) as z.ZodType<O, I>;
}

// Usage:
const payloadSchema = toZodSchema(MultiPayloadNarrowedValidator);
// =============================================================

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

const validNep413Message = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	signer_id: "bob.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

describe("z.fromJSONSchema with MultiPayloadNarrowed", () => {
	it("validates erc191 variant", () => {
		const input: MultiPayloadNarrowed = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = schemaFromJSON.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(input);
		}
	});

	it("validates nep413 variant", () => {
		const input: MultiPayloadNarrowed = {
			standard: "nep413",
			payload: {
				message: validNep413Message,
				nonce: "dGVzdG5vbmNl",
				recipient: "defuse.near",
			},
		};

		const result = schemaFromJSON.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(input);
		}
	});

	it("rejects invalid standard", () => {
		const input = {
			standard: "invalid",
			payload: validDefusePayload,
		};

		const result = schemaFromJSON.safeParse(input);
		expect(result.success).toBe(false);
	});

	it("works in composite schema", () => {
		const requestSchema = z.object({
			id: z.string(),
			timestamp: z.number(),
			payload: schemaFromJSON,
		});

		const input = {
			id: "req-123",
			timestamp: Date.now(),
			payload: {
				standard: "erc191",
				payload: validDefusePayload,
			},
		};

		const result = requestSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe("req-123");
			expect(result.data.payload.standard).toBe("erc191");
		}
	});
});

describe("toZodSchema wrapper", () => {
	it("validates and transforms with JSON parsing", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = payloadSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success && result.data.standard === "erc191") {
			// Type narrowing: result.data.payload is now { original: string; parsed: DefusePayloadFor_DefuseIntents }
			expect(result.data.payload.original).toBe(validDefusePayload);
			expect(result.data.payload.parsed.signer_id).toBe("bob.near");
		}
	});

	it("rejects invalid payload with error message", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
		};

		const result = payloadSchema.safeParse(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.length).toBeGreaterThan(0);
			expect(result.error.issues[0]?.message).toBeDefined();
		}
	});

	it("works in composite schema", () => {
		const requestSchema = z.object({
			id: z.string(),
			timestamp: z.number(),
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

		const result = requestSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success && result.data.payload.standard === "erc191") {
			expect(result.data.id).toBe("req-123");
			// Type narrowing works through nested objects
			expect(result.data.payload.payload.original).toBe(validDefusePayload);
		}
	});

	it("rejects when outer schema fails", () => {
		const requestSchema = z.object({
			id: z.string(),
			timestamp: z.number(),
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

		const result = requestSchema.safeParse(input);
		expect(result.success).toBe(false);
	});
});

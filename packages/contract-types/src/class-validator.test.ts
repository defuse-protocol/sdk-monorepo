import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
	registerDecorator,
	validate,
	type ValidationArguments,
	type ValidationOptions,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { plainToInstance } from "class-transformer";
import { MultiPayloadNarrowedValidator } from "./validate.js";
import type { Validator } from "./standard-schema.js";
import type { MultiPayloadNarrowed__Parsed } from "./index.js";
import type { AnySchema } from "ajv";

// ========== DECORATORS (copy to your codebase) ==========
// Validates a property using a Defuse validator.
// On success, replaces the property value with the parsed output.
function ValidateWithSchema<I, O>(
	validator: Validator<I, O>,
	validationOptions?: ValidationOptions,
) {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: "validateWithSchema",
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown, args: ValidationArguments) {
					const result = validator.validate(value);
					if (result.issues) {
						return false;
					}
					// Replace property with parsed value from validator
					(args.object as Record<string, unknown>)[args.property] =
						result.value;
					return true;
				},
				defaultMessage(args: ValidationArguments) {
					const result = validator.validate(args.value);
					if (result.issues) {
						return result.issues
							.map((i) => `${i.path?.join(".") || args.property}: ${i.message}`)
							.join("; ");
					}
					return `${args.property} validation failed`;
				},
			},
		});
	};
}

/**
 * Extract description from schema if available.
 */
function getSchemaDescription(schema: AnySchema): string | undefined {
	return typeof schema === "object" &&
		schema !== null &&
		"description" in schema &&
		typeof schema.description === "string"
		? schema.description
		: undefined;
}

/**
 * Combined decorator that applies both @ApiProperty and @ValidateWithSchema.
 * Use with validators from @defuse-protocol/contract-types/validate.
 * Automatically extracts description from schema if not provided in apiOptions.
 *
 * @example
 * @SchemaProperty(MultiPayloadValidator)
 * signedIntent!: InferOutput<typeof MultiPayloadValidator>;
 */
function SchemaProperty<I, O>(
	validator: Validator<I, O>,
	apiOptions?: Parameters<typeof ApiProperty>[0],
	validationOptions?: ValidationOptions,
): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		const schemaDescription = getSchemaDescription(validator.schema);
		const mergedOptions = {
			...(schemaDescription && { description: schemaDescription }),
			...apiOptions,
		};
		ApiProperty(mergedOptions)(target, propertyKey);
		ValidateWithSchema(validator, validationOptions)(
			target,
			propertyKey as string,
		);
	};
}

// Usage:
class IntentRequest {
	@ValidateWithSchema(MultiPayloadNarrowedValidator)
	payload!: MultiPayloadNarrowed__Parsed;
}

class IntentRequestWithSwagger {
	@SchemaProperty(MultiPayloadNarrowedValidator)
	payload!: MultiPayloadNarrowed__Parsed;
}
// =====================================================

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

describe("ValidateWithSchema decorator", () => {
	it("validates and transforms with JSON parsing", async () => {
		const input = plainToInstance(IntentRequest, {
			payload: {
				standard: "erc191",
				payload: validDefusePayload,
			},
		});

		const errors = await validate(input);
		expect(errors).toHaveLength(0);

		// After validation, payload is transformed
		if (input.payload.standard === "erc191") {
			expect(input.payload.payload.original).toBe(validDefusePayload);
			expect(input.payload.payload.parsed.signer_id).toBe("bob.near");
		}
	});

	it("rejects invalid payload with error message", async () => {
		const input = plainToInstance(IntentRequest, {
			payload: {
				standard: "erc191",
				payload: "not valid json",
			},
		});

		const errors = await validate(input);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.constraints?.validateWithSchema).toBeDefined();
	});
});

describe("SchemaProperty decorator", () => {
	it("validates and transforms like ValidateWithSchema", async () => {
		const input = plainToInstance(IntentRequestWithSwagger, {
			payload: {
				standard: "erc191",
				payload: validDefusePayload,
			},
		});

		const errors = await validate(input);
		expect(errors).toHaveLength(0);

		if (input.payload.standard === "erc191") {
			expect(input.payload.payload.original).toBe(validDefusePayload);
			expect(input.payload.payload.parsed.signer_id).toBe("bob.near");
		}
	});

	it("rejects invalid payload with error message", async () => {
		const input = plainToInstance(IntentRequestWithSwagger, {
			payload: {
				standard: "erc191",
				payload: "not valid json",
			},
		});

		const errors = await validate(input);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.constraints?.validateWithSchema).toBeDefined();
	});
});

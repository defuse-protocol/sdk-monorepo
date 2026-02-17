import { describe, expect, it } from "vitest";
import {
	addCustomDefinitions,
	addParseJsonKeywords,
	addStrictAdditionalProperties,
	dereferenceSchema,
	extractDiscriminatedUnions,
	extractSchemaFromAbi,
	expandPropertiesWithAnyOf,
	findDiscriminatorProperty,
	fixAnyOfNullable,
	fixDictionaryTypes,
	fixNullableTypes,
	fixOptionalProperties,
	flattenAllOf,
	moveContentEncodingToDescription,
	removeDefinitions,
	removeDiscriminator,
	deduplicateOneOf,
	type JsonSchema,
} from "./gen-defuse-types.js";

describe("extractSchemaFromAbi", () => {
	it("removes root type and adds title", () => {
		const result = extractSchemaFromAbi({
			body: {
				root_schema: {
					type: "object",
					definitions: { AccountId: { type: "string" } },
				},
			},
		});

		expect(result).toEqual({
			title: "NEAR Intents Schema",
			definitions: { AccountId: { type: "string" } },
		});
	});
});

describe("expandPropertiesWithAnyOf", () => {
	it("expands oneOf variants that have both properties and anyOf", () => {
		const result = expandPropertiesWithAnyOf({
			definitions: {
				Example: {
					oneOf: [
						{
							type: "object",
							required: ["base"],
							properties: { base: { type: "string" } },
							anyOf: [
								{
									description: "A",
									required: ["a"],
									properties: { a: { type: "number" } },
								},
								{
									description: "B",
									required: ["b"],
									properties: { b: { type: "boolean" } },
								},
							],
						},
						{ type: "string" },
					],
				},
			},
		});

		expect(result).toEqual({
			definitions: {
				Example: {
					oneOf: [
						{
							type: "object",
							description: "A",
							required: ["base", "a"],
							properties: { base: { type: "string" }, a: { type: "number" } },
						},
						{
							type: "object",
							description: "B",
							required: ["base", "b"],
							properties: { base: { type: "string" }, b: { type: "boolean" } },
						},
						{ type: "string" },
					],
				},
			},
		});
	});

	it("leaves oneOf variants without anyOf unchanged", () => {
		const schema: JsonSchema = {
			oneOf: [{ type: "string" }, { type: "number" }],
		};

		expect(expandPropertiesWithAnyOf(schema)).toEqual(schema);
	});
});

describe("moveContentEncodingToDescription", () => {
	it("moves contentEncoding to description", () => {
		const result = moveContentEncodingToDescription({
			definitions: {
				PublicKey: {
					type: "string",
					description: "NEAR public key",
					contentEncoding: "base58",
				},
				Nonce: { type: "string", contentEncoding: "base64" },
			},
		});

		expect(result).toEqual({
			definitions: {
				PublicKey: {
					type: "string",
					description: "NEAR public key. Encoding: base58",
				},
				Nonce: { type: "string", description: "Encoding: base64" },
			},
		});
	});
});

describe("removeDefinitions", () => {
	it("removes ABI helper definitions", () => {
		const result = removeDefinitions({
			definitions: {
				AccountId: { type: "string" },
				AbiHelper: { type: "object" },
				Promise: { type: "object" },
				Intent: { oneOf: [] },
			},
		});

		expect(result).toEqual({
			definitions: {
				AccountId: { type: "string" },
				Intent: { oneOf: [] },
			},
		});
	});
});

describe("addStrictAdditionalProperties", () => {
	it("adds additionalProperties: false to objects with properties", () => {
		const result = addStrictAdditionalProperties({
			type: "object",
			properties: { name: { type: "string" } },
		});

		expect(result).toEqual({
			type: "object",
			properties: { name: { type: "string" } },
			additionalProperties: false,
		});
	});

	it("preserves existing additionalProperties", () => {
		const schema: JsonSchema = {
			type: "object",
			additionalProperties: { type: "string" },
		};

		expect(addStrictAdditionalProperties(schema)).toEqual(schema);
	});
});

describe("findDiscriminatorProperty", () => {
	it("finds property with single-value enum across all variants", () => {
		const discriminator = findDiscriminatorProperty([
			{
				properties: {
					kind: { type: "string", enum: ["a"] },
					x: { type: "string" },
				},
			},
			{
				properties: {
					kind: { type: "string", enum: ["b"] },
					y: { type: "number" },
				},
			},
		]);

		expect(discriminator).toBe("kind");
	});

	it("returns null when no single-value enum property exists", () => {
		const discriminator = findDiscriminatorProperty([
			{ properties: { a: { type: "string" } } },
			{ properties: { b: { type: "number" } } },
		]);

		expect(discriminator).toBeNull();
	});
});

describe("extractDiscriminatedUnions", () => {
	it("extracts inline variants to definitions and adds discriminator", () => {
		const result = extractDiscriminatedUnions({
			definitions: {
				Action: {
					oneOf: [
						{
							type: "object",
							properties: {
								action: { type: "string", enum: ["create"] },
								name: { type: "string" },
							},
						},
						{
							type: "object",
							properties: {
								action: { type: "string", enum: ["delete"] },
								id: { type: "number" },
							},
						},
					],
				},
			},
		});

		expect(result).toEqual({
			definitions: {
				Action: {
					oneOf: [
						{ $ref: "#/definitions/ActionCreate" },
						{ $ref: "#/definitions/ActionDelete" },
					],
					discriminator: {
						propertyName: "action",
						mapping: {
							create: "#/definitions/ActionCreate",
							delete: "#/definitions/ActionDelete",
						},
					},
				},
				ActionCreate: {
					type: "object",
					properties: {
						action: { type: "string", enum: ["create"] },
						name: { type: "string" },
					},
				},
				ActionDelete: {
					type: "object",
					properties: {
						action: { type: "string", enum: ["delete"] },
						id: { type: "number" },
					},
				},
			},
		});
	});

	it("merges property patterns for variants with the same discriminator value", () => {
		const result = extractDiscriminatedUnions({
			definitions: {
				MultiPayload: {
					oneOf: [
						{
							type: "object",
							properties: {
								standard: { type: "string", enum: ["webauthn"] },
								public_key: { type: "string", pattern: "^ed25519:" },
								signature: { type: "string", pattern: "^ed25519:" },
							},
						},
						{
							type: "object",
							properties: {
								standard: { type: "string", enum: ["webauthn"] },
								public_key: { type: "string", pattern: "^p256:" },
								signature: { type: "string", pattern: "^p256:" },
							},
						},
					],
				},
			},
		});

		expect(result.definitions?.MultiPayload?.oneOf).toEqual([
			{ $ref: "#/definitions/MultiPayloadWebauthn" },
		]);
		expect(
			result.definitions?.MultiPayloadWebauthn?.properties?.public_key,
		).toEqual(
			expect.objectContaining({ pattern: "^(ed25519:|p256:)" }),
		);
		expect(
			result.definitions?.MultiPayloadWebauthn?.properties?.signature,
		).toEqual(
			expect.objectContaining({ pattern: "^(ed25519:|p256:)" }),
		);
	});
});

describe("deduplicateOneOf", () => {
	it("removes duplicate entries from oneOf arrays", () => {
		const variant = {
			type: "object",
			properties: {
				standard: { type: "string", enum: ["webauthn"] },
				public_key: { type: "string", pattern: "^p256:" },
			},
			additionalProperties: false,
		};

		const result = deduplicateOneOf({
			definitions: {
				MultiPayload: {
					oneOf: [variant, variant],
				},
			},
		});

		expect(result.definitions?.MultiPayload?.oneOf).toEqual([variant]);
	});

	it("keeps distinct entries in oneOf", () => {
		const v1 = { type: "object", properties: { a: { type: "string" } } };
		const v2 = { type: "object", properties: { b: { type: "string" } } };

		const result = deduplicateOneOf({
			definitions: { Union: { oneOf: [v1, v2] } },
		});

		expect(result.definitions?.Union?.oneOf).toEqual([v1, v2]);
	});
});

describe("addCustomDefinitions", () => {
	it("creates Nep413DefusePayload, MultiPayloadNarrowed and Parsed variants", () => {
		const result = addCustomDefinitions({
			definitions: {
				DefusePayload_for_DefuseIntents: {
					type: "object",
					required: ["deadline", "signer_id", "intents", "verifying_contract"],
					properties: {
						deadline: { type: "string" },
						signer_id: { type: "string" },
						intents: { type: "array" },
						verifying_contract: { type: "string" },
					},
				},
				MultiPayload: {
					oneOf: [{ $ref: "#/definitions/MultiPayloadErc191" }],
				},
				MultiPayloadErc191: {
					type: "object",
					required: ["standard", "payload", "signature"],
					properties: {
						standard: { type: "string", enum: ["erc191"] },
						payload: { type: "string" },
						signature: { type: "string" },
					},
				},
			},
		});

		expect(result.definitions?.Nep413DefusePayload).toEqual({
			type: "object",
			required: ["deadline", "signer_id", "intents"],
			properties: {
				deadline: { type: "string" },
				signer_id: { type: "string" },
				intents: { type: "array" },
			},
			additionalProperties: false,
		});

		expect(result.definitions?.MultiPayloadNarrowed).toEqual({
			oneOf: [
				{
					type: "object",
					required: ["standard", "payload"],
					additionalProperties: false,
					properties: {
						standard: { type: "string", enum: ["erc191"] },
						payload: { type: "string" },
					},
				},
			],
		});

		expect(result.definitions?.MultiPayloadErc191__Parsed).toBeDefined();
		// Parsed variants now have wrapper: { original: string, parsed: T }
		expect(
			result.definitions?.MultiPayloadErc191__Parsed?.properties?.payload,
		).toEqual({
			type: "object",
			required: ["original", "parsed"],
			additionalProperties: false,
			properties: {
				original: { type: "string" },
				parsed: { $ref: "#/definitions/DefusePayload_for_DefuseIntents" },
			},
		});
	});

	it("returns unchanged schema if MultiPayload is missing", () => {
		const schema: JsonSchema = { definitions: { Foo: { type: "string" } } };
		expect(addCustomDefinitions(schema)).toEqual(schema);
	});

	it("creates TonConnectPayloadSchema__Parsed with wrapped text field", () => {
		const result = addCustomDefinitions({
			definitions: {
				DefusePayload_for_DefuseIntents: {
					type: "object",
					required: ["deadline", "signer_id", "intents", "verifying_contract"],
					properties: {
						deadline: { type: "string" },
						signer_id: { type: "string" },
						intents: { type: "array" },
						verifying_contract: { type: "string" },
					},
				},
				MultiPayload: {
					oneOf: [{ $ref: "#/definitions/MultiPayloadTonConnect" }],
				},
				MultiPayloadTonConnect: {
					type: "object",
					required: ["standard", "payload", "signature"],
					properties: {
						standard: { type: "string", enum: ["ton_connect"] },
						payload: { $ref: "#/definitions/TonConnectPayloadSchema" },
						signature: { type: "string" },
					},
				},
				TonConnectPayloadSchema: {
					oneOf: [
						{
							type: "object",
							properties: {
								type: { type: "string", enum: ["text"] },
								text: { type: "string" },
							},
						},
						{
							type: "object",
							properties: {
								type: { type: "string", enum: ["binary"] },
								data: { type: "string" },
							},
						},
					],
				},
			},
		});

		expect(result.definitions?.TonConnectPayloadSchema__Parsed).toEqual({
			oneOf: [
				{
					type: "object",
					properties: {
						type: { type: "string", enum: ["text"] },
						text: {
							type: "object",
							required: ["original", "parsed"],
							additionalProperties: false,
							properties: {
								original: { type: "string" },
								parsed: {
									$ref: "#/definitions/DefusePayload_for_DefuseIntents",
								},
							},
						},
					},
				},
				{
					type: "object",
					properties: {
						type: { type: "string", enum: ["binary"] },
						data: { type: "string" },
					},
				},
			],
		});

		expect(
			result.definitions?.MultiPayloadTonConnect__Parsed?.properties?.payload,
		).toEqual({
			$ref: "#/definitions/TonConnectPayloadSchema__Parsed",
		});
	});
});

describe("dereferenceSchema", () => {
	it("inlines $ref references", () => {
		const result = dereferenceSchema({
			definitions: {
				AccountId: { description: "NEAR Account", type: "string" },
				Transfer: {
					type: "object",
					properties: { to: { $ref: "#/definitions/AccountId" } },
				},
			},
		});

		expect(result.definitions?.Transfer?.properties?.to).toEqual({
			description: "NEAR Account",
			type: "string",
		});
	});
});

describe("fixNullableTypes", () => {
	it('converts type: ["T", "null"] to type: "T" with nullable: true', () => {
		const result = fixNullableTypes({
			properties: {
				count: { type: ["number", "null"] },
				name: { type: ["string", "null"] },
			},
		});

		expect(result).toEqual({
			properties: {
				count: { type: "number", nullable: true },
				name: { type: "string", nullable: true },
			},
		});
	});
});

describe("fixDictionaryTypes", () => {
	it("adds required: [] to dictionary types", () => {
		const result = fixDictionaryTypes({
			type: "object",
			additionalProperties: { type: "string" },
		});

		expect(result).toEqual({
			type: "object",
			additionalProperties: { type: "string" },
			required: [],
		});
	});
});

describe("fixOptionalProperties", () => {
	it("adds nullable: true to optional properties with scalar types", () => {
		const result = fixOptionalProperties({
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string" },
				name: { type: "string" },
				count: { type: "number" },
			},
		});

		expect(result).toEqual({
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string" },
				name: { type: "string", nullable: true },
				count: { type: "number", nullable: true },
			},
		});
	});

	it("does not add nullable to optional properties with oneOf", () => {
		const result = fixOptionalProperties({
			type: "object",
			required: ["id"],
			properties: {
				id: { type: "string" },
				variant: { oneOf: [{ type: "object" }, { type: "string" }] },
			},
		});

		expect(result.properties?.variant?.nullable).toBeUndefined();
	});
});

describe("flattenAllOf", () => {
	it("flattens single-item allOf, preserving outer description", () => {
		const result = flattenAllOf({
			description: "outer",
			allOf: [{ type: "string", description: "inner" }],
		});

		expect(result).toEqual({
			description: "outer",
			type: "string",
		});
	});
});

describe("fixAnyOfNullable", () => {
	it("converts anyOf with null to nullable for simple types", () => {
		const result = fixAnyOfNullable({
			anyOf: [{ type: "string", description: "Name" }, { type: "null" }],
		});

		expect(result).toEqual({
			type: "string",
			description: "Name",
			nullable: true,
		});
	});

	it("converts anyOf containing oneOf to oneOf with null variant", () => {
		const result = fixAnyOfNullable({
			anyOf: [
				{ oneOf: [{ type: "object" }, { type: "string" }] },
				{ type: "null" },
			],
		});

		expect(result).toEqual({
			oneOf: [{ type: "object" }, { type: "string" }, { type: "null" }],
		});
	});
});

describe("removeDiscriminator", () => {
	it("removes discriminator from schema", () => {
		const result = removeDiscriminator({
			oneOf: [{ type: "object" }],
			discriminator: { propertyName: "type" },
		});

		expect(result).toEqual({
			oneOf: [{ type: "object" }],
		});
	});
});

describe("addParseJsonKeywords", () => {
	it("adds parseJson to erc191 payload field", () => {
		const defusePayload = {
			type: "object" as const,
			properties: { deadline: {} },
		};
		const nep413Payload = {
			type: "object" as const,
			properties: { message: {} },
		};
		const result = addParseJsonKeywords({
			definitions: {
				DefusePayload_for_DefuseIntents: defusePayload,
				Nep413DefusePayload: nep413Payload,
				MultiPayload: {
					oneOf: [
						{
							properties: {
								standard: { enum: ["erc191"] },
								payload: { type: "string" },
							},
						},
					],
				},
			},
		});

		const variant = result.definitions?.MultiPayload?.oneOf?.[0];
		expect(variant?.properties?.payload?.parseJson).toEqual(defusePayload);
	});

	it("adds parseJson to nep413 payload.message field", () => {
		const defusePayload = {
			type: "object" as const,
			properties: { deadline: {} },
		};
		const nep413Payload = {
			type: "object" as const,
			properties: { message: {} },
		};
		const result = addParseJsonKeywords({
			definitions: {
				DefusePayload_for_DefuseIntents: defusePayload,
				Nep413DefusePayload: nep413Payload,
				MultiPayload: {
					oneOf: [
						{
							properties: {
								standard: { enum: ["nep413"] },
								payload: {
									properties: { message: { type: "string" } },
								},
							},
						},
					],
				},
			},
		});

		const variant = result.definitions?.MultiPayload?.oneOf?.[0];
		expect(
			variant?.properties?.payload?.properties?.message?.parseJson,
		).toEqual(nep413Payload);
	});

	it("returns unchanged schema if MultiPayload is missing", () => {
		const schema: JsonSchema = { definitions: { Foo: { type: "string" } } };
		expect(addParseJsonKeywords(schema)).toEqual(schema);
	});
});

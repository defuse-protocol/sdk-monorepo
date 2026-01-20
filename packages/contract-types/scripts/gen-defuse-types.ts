// NOTE: Do not use typecasting (`as unknown as T`) to silence TypeScript errors.
// If you encounter type errors, either fix the root cause, throw an error, or
// ask for help. Typecasting hides real problems.

import { execSync } from "node:child_process";
// biome-ignore lint/style/noRestrictedImports: it's a script so it's ok
import * as fs from "node:fs";
// biome-ignore lint/style/noRestrictedImports: it's a script so it's ok
import * as path from "node:path";
import { compile } from "json-schema-to-typescript";
import type { JSONSchema4, JSONSchema4TypeName } from "json-schema";

/**
 * Suffix for Parsed type variants. Uses double underscore to avoid accidental matches
 * with other types that might legitimately end with "Parsed".
 */
const PARSED_SUFFIX = "__Parsed";

/**
 * Standards where payload is a JSON string that gets parsed to DefusePayload.
 * These have straightforward string → JSON parsing.
 */
const SIMPLE_PAYLOAD_STANDARDS = [
	"erc191",
	"raw_ed25519",
	"sep53",
	"tip191",
	"webauthn",
] as const;

/**
 * Standards with special payload handling (nested message field, complex structure).
 * Each requires explicit handling in createParsedVariant() and addParseJsonToVariant().
 */
const SPECIAL_PAYLOAD_STANDARDS = ["nep413", "ton_connect"] as const;

/**
 * All standards supported by the MultiPayload type.
 * This list MUST match exactly what's in the contract schema.
 * If the schema changes, update this list and handle any new standards
 * in createParsedVariant() and addParseJsonToVariant().
 */
const ALL_SUPPORTED_STANDARDS = [
	...SIMPLE_PAYLOAD_STANDARDS,
	...SPECIAL_PAYLOAD_STANDARDS,
] as const;

/**
 * Types that are incompatible with AJV's JSONSchemaType due to AJV v8 limitations.
 * These require `as unknown as` casts in the generated code.
 * See: https://github.com/ajv-validator/ajv/issues/2132
 */
const JSONSCHEMATYPE_INCOMPATIBLE: Record<string, string> = {
	SimulationOutput:
		"Optional union property (invariant_violated?: InvariantViolated | null) - AJV limitation",
};

/**
 * Extended JSON Schema with custom properties for our transformations.
 * Extends JSONSchema4 for type safety while allowing our custom keywords.
 */
export interface JsonSchema extends JSONSchema4 {
	// Custom keywords we add during processing
	parseJson?: JsonSchema;
	discriminator?: { propertyName: string; mapping?: Record<string, string> };
	nullable?: boolean;
	contentEncoding?: string;
	// Override recursive types to use our extended interface
	definitions?: Record<string, JsonSchema>;
	properties?: Record<string, JsonSchema>;
	additionalProperties?: boolean | JsonSchema;
	items?: JsonSchema | JsonSchema[];
	oneOf?: JsonSchema[];
	anyOf?: JsonSchema[];
	allOf?: JsonSchema[];
	not?: JsonSchema;
}

/**
 * Type guard: checks if value is a non-empty array where all elements are strings.
 */
function isNonEmptyStringArray(value: unknown): value is [string, ...string[]] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item) => typeof item === "string")
	);
}

/**
 * Safely extracts the required array from an unknown value.
 * In JSONSchema4, `required` can be `boolean | string[]`. This normalizes it to `string[]`.
 */
function getRequiredArray(value: unknown): string[] {
	if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
		return value;
	}
	return [];
}

/**
 * Extracts the first enum value as a string from a schema.
 * Returns null if the schema doesn't have a single-element string enum.
 * Used for discriminator property detection where enums contain string literals.
 */
function getEnumStringValue(schema: JsonSchema | undefined): string | null {
	const enumValues = schema?.enum;
	if (
		!Array.isArray(enumValues) ||
		enumValues.length !== 1 ||
		typeof enumValues[0] !== "string"
	) {
		return null;
	}
	return enumValues[0];
}

const VALID_TYPE_NAMES = [
	"string",
	"number",
	"integer",
	"boolean",
	"object",
	"array",
	"null",
	"any",
] as const;

// assert the inferred type of VALID_TYPE_NAMES is exactly equal to JSONSchema4TypeName
type ValidTypeName = (typeof VALID_TYPE_NAMES)[number];
type AssertValidTypeName = ValidTypeName extends JSONSchema4TypeName
	? JSONSchema4TypeName extends ValidTypeName
		? true
		: never
	: never;
// This will cause a compile error if ValidTypeName is not exactly equal to JSONSchema4TypeName
const _assertValidTypeName: AssertValidTypeName = true;

function isValidTypeName(value: string): value is JSONSchema4TypeName {
	return VALID_TYPE_NAMES.includes(value as JSONSchema4TypeName);
}

/**
 * Extracts the "type" field as a string array when it's an array of types.
 * Used for handling nullable types like ["string", "null"].
 * Returns null if not an array of strings or if any element is not a valid type name.
 */
function getTypeArray(
	typeValue: unknown,
): [JSONSchema4TypeName, ...JSONSchema4TypeName[]] | null {
	if (!isNonEmptyStringArray(typeValue)) {
		return null;
	}
	// Destructure to validate first and rest separately, then combine
	const [first, ...rest] = typeValue;
	if (!isValidTypeName(first)) {
		return null;
	}
	const validatedRest: JSONSchema4TypeName[] = [];
	for (const t of rest) {
		if (!isValidTypeName(t)) {
			return null;
		}
		validatedRest.push(t);
	}
	return [first, ...validatedRest];
}

interface AbiJson {
	body: {
		root_schema: JsonSchema;
	};
}

export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

/**
 * Type guard: checks if value is a plain object (not null, not array).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Asserts that a value is a JsonSchema object.
 * Throws if the value is null, array, or primitive.
 */
function assertJsonSchema(
	value: unknown,
	context: string,
): asserts value is JsonSchema {
	if (!isPlainObject(value)) {
		throw new Error(
			`Expected schema object in ${context}, got ${Array.isArray(value) ? "array" : typeof value}`,
		);
	}
}

/**
 * Validates that the standards in the schema match ALL_SUPPORTED_STANDARDS.
 * Throws with instructions if they don't match.
 */
function validateSchemaStandards(schema: JsonSchema): void {
	const multiPayload = schema.definitions?.MultiPayload;
	if (!multiPayload?.oneOf) {
		throw new Error(
			"MultiPayload definition not found or has no oneOf variants",
		);
	}

	const schemaStandards = new Set<string>();
	for (const variant of multiPayload.oneOf) {
		const standard = getEnumStringValue(variant.properties?.standard);
		if (standard) {
			schemaStandards.add(standard);
		}
	}

	const expectedStandards = new Set<string>(ALL_SUPPORTED_STANDARDS);

	const missingFromCode = [...schemaStandards].filter(
		(s) => !expectedStandards.has(s),
	);
	const removedFromSchema = [...expectedStandards].filter(
		(s) => !schemaStandards.has(s),
	);

	if (missingFromCode.length > 0 || removedFromSchema.length > 0) {
		const lines: string[] = [
			"Schema standards mismatch!",
			"",
			"Schema path: definitions.MultiPayload.oneOf[*].properties.standard.enum[0]",
			"",
		];

		if (missingFromCode.length > 0) {
			lines.push(`New standards in schema: ${missingFromCode.join(", ")}`);
		}
		if (removedFromSchema.length > 0) {
			lines.push(
				`Standards no longer in schema: ${removedFromSchema.join(", ")}`,
			);
		}

		lines.push(
			"",
			"To fix this:",
			"1. Update SIMPLE_PAYLOAD_STANDARDS or SPECIAL_PAYLOAD_STANDARDS at the top of this file",
			"2. If adding a new standard with a simple string payload, add it to SIMPLE_PAYLOAD_STANDARDS",
			"3. If adding a standard with special payload handling (like nep413 or ton_connect),",
			"   add it to SPECIAL_PAYLOAD_STANDARDS and add handling in createParsedVariant() and addParseJsonToVariant()",
		);

		throw new Error(lines.join("\n"));
	}

	// Warn about removed special standards - their handling code can be cleaned up
	const specialStandards = new Set<string>(SPECIAL_PAYLOAD_STANDARDS);
	const removedSpecialStandards = [...specialStandards].filter(
		(s) => !schemaStandards.has(s),
	);
	for (const standard of removedSpecialStandards) {
		// biome-ignore lint/suspicious/noConsole: script warning
		console.warn(
			`Warning: Special standard "${standard}" no longer in schema. ` +
				`Remove it from SPECIAL_PAYLOAD_STANDARDS and clean up its handling in createParsedVariant() and addParseJsonToVariant().`,
		);
	}
}

/**
 * Extracts unique standards from the MultiPayload oneOf variants.
 * Handles both inline variants and $ref variants.
 */
function extractStandardsFromSchema(schema: JsonSchema): string[] {
	const definitions = schema.definitions ?? {};
	const multiPayload = definitions.MultiPayload;
	if (!multiPayload?.oneOf) {
		return [];
	}

	const standards = new Set<string>();
	for (const variant of multiPayload.oneOf) {
		// Resolve $ref if present
		const resolved = variant.$ref
			? definitions[variant.$ref.replace("#/definitions/", "")]
			: variant;
		const standard = getEnumStringValue(resolved?.properties?.standard);
		if (standard) {
			standards.add(standard);
		}
	}
	return [...standards];
}

/**
 * Converts a standard name to an uppercase enum key.
 * e.g., "erc191" -> "ERC191", "ton_connect" -> "TON_CONNECT"
 */
function standardToEnumKey(standard: string): string {
	return standard.toUpperCase();
}

/**
 * Generates the IntentStandardEnum code from the list of standards.
 */
function generateIntentStandardEnum(standards: string[]): string {
	const entries = standards
		.map((s) => `\t${standardToEnumKey(s)} = "${s}",`)
		.join("\n");

	return `
/**
 * Enum of supported intent standards.
 * Generated from the MultiPayload schema variants.
 */
export enum IntentStandardEnum {
${entries}
}
`;
}

/**
 * Validates that required definitions exist in the schema.
 */
function validateRequiredDefinitions(schema: JsonSchema): void {
	const definitions = schema.definitions ?? {};

	// DefusePayload_for_DefuseIntents is required for payload parsing
	if (!definitions.DefusePayload_for_DefuseIntents) {
		throw new Error(
			"Required definition 'DefusePayload_for_DefuseIntents' not found in schema",
		);
	}
}

/**
 * Warns about definitions that are marked for removal but don't exist.
 * This indicates the schema may have changed and DEFINITIONS_TO_REMOVE can be cleaned up.
 */
function warnAboutMissingDefinitionsToRemove(schema: JsonSchema): void {
	const definitions = schema.definitions ?? {};

	for (const name of DEFINITIONS_TO_REMOVE) {
		if (!definitions[name]) {
			// biome-ignore lint/suspicious/noConsole: script warning
			console.warn(
				`Warning: Definition "${name}" not found in schema. ` +
					`Consider removing it from DEFINITIONS_TO_REMOVE.`,
			);
		}
	}
}

/**
 * Warns about JSONSCHEMATYPE_INCOMPATIBLE entries that no longer exist.
 */
function warnAboutObsoleteIncompatibleTypes(
	schema: JsonSchema,
	incompatibleTypes: Record<string, string>,
): void {
	const definitions = schema.definitions ?? {};

	for (const name of Object.keys(incompatibleTypes)) {
		if (!definitions[name]) {
			// biome-ignore lint/suspicious/noConsole: script warning
			console.warn(
				`Warning: Type "${name}" in JSONSCHEMATYPE_INCOMPATIBLE no longer exists in schema. ` +
					`Consider removing it from the incompatible types list in generateValidateTs().`,
			);
		}
	}
}

/**
 * Generic tree transformer for JSON Schema transformations.
 * Handles the recursive traversal pattern without type casts.
 *
 * @param value - The value to transform (can be any JSON value)
 * @param transformObject - Callback to transform plain objects. Receives the object
 *   entries and a recurse function. Should return the transformed object entries.
 */
function transformTree(
	value: unknown,
	transformObject: (
		entries: [string, unknown][],
		recurse: (v: unknown) => unknown,
	) => [string, unknown][],
): unknown {
	if (!isPlainObject(value)) {
		if (Array.isArray(value)) {
			return value.map((item) => transformTree(item, transformObject));
		}
		return value;
	}

	const recurse = (v: unknown): unknown => transformTree(v, transformObject);
	const transformedEntries = transformObject(Object.entries(value), recurse);
	return Object.fromEntries(transformedEntries);
}

/**
 * Creates a schema transformer function from a tree transformation callback.
 * The callback receives object entries and a recurse function.
 */
function createSchemaTransformer(
	name: string,
	transformObject: (
		entries: [string, unknown][],
		recurse: (v: unknown) => unknown,
	) => [string, unknown][],
): (schema: JsonSchema) => JsonSchema {
	return (schema: JsonSchema): JsonSchema => {
		const result = transformTree(schema, transformObject);
		assertJsonSchema(result, name);
		return result;
	};
}

// ============================================================================
// Step 1: Extract schema from ABI
// ============================================================================

export function extractSchemaFromAbi(abi: AbiJson): JsonSchema {
	const schema = deepClone(abi.body.root_schema);
	delete schema.type; // Remove unnecessary root "type"
	schema.title = "NEAR Intents Schema";
	return schema;
}

// ============================================================================
// Step 2: Expand objects with both properties and anyOf
// When an object has both "properties" and "anyOf", it means "base properties
// + one of these variants". This needs to be expanded into separate objects
// with merged properties for proper JSON Schema validation.
// ============================================================================

export function expandPropertiesWithAnyOf(schema: JsonSchema): JsonSchema {
	function recurse(value: unknown): unknown {
		if (!isPlainObject(value)) {
			if (Array.isArray(value)) {
				return value.map(recurse);
			}
			return value;
		}

		const result: Record<string, unknown> = {};

		for (const [key, val] of Object.entries(value)) {
			if (key === "oneOf" && Array.isArray(val)) {
				const expandedOneOf: unknown[] = [];

				for (const variant of val) {
					if (!isPlainObject(variant)) {
						expandedOneOf.push(recurse(variant));
						continue;
					}

					const variantAnyOf = variant.anyOf;
					if (
						variant.properties &&
						isPlainObject(variant.properties) &&
						Array.isArray(variantAnyOf)
					) {
						// Expand: merge base properties with each anyOf variant
						for (const anyOfItem of variantAnyOf) {
							if (!isPlainObject(anyOfItem)) continue;

							const anyOfProps = anyOfItem.properties;
							const expanded: Record<string, unknown> = {
								type: variant.type ?? "object",
								required: [
									...getRequiredArray(variant.required),
									...getRequiredArray(anyOfItem.required),
								],
								properties: {
									...variant.properties,
									...(isPlainObject(anyOfProps) ? anyOfProps : {}),
								},
							};
							if (anyOfItem.description) {
								expanded.description = anyOfItem.description;
							}
							expandedOneOf.push(recurse(expanded));
						}
					} else {
						expandedOneOf.push(recurse(variant));
					}
				}

				result[key] = expandedOneOf;
			} else {
				result[key] = recurse(val);
			}
		}

		return result;
	}

	const result = recurse(schema);
	assertJsonSchema(result, "expandPropertiesWithAnyOf");
	return result;
}

// ============================================================================
// Step 3: Move contentEncoding to description
// contentEncoding is not standard JSON Schema, but we preserve the info
// ============================================================================

export const moveContentEncodingToDescription = createSchemaTransformer(
	"moveContentEncodingToDescription",
	(entries, recurse) => {
		const obj = Object.fromEntries(entries);
		const result: [string, unknown][] = [];

		for (const [key, value] of entries) {
			if (key !== "contentEncoding") {
				result.push([key, recurse(value)]);
			}
		}

		if (typeof obj.contentEncoding === "string") {
			const encodingNote = `Encoding: ${obj.contentEncoding}`;
			const existingDesc = obj.description;
			const newDesc =
				typeof existingDesc === "string"
					? `${existingDesc}. ${encodingNote}`
					: encodingNote;
			// Find and update description entry, or add it
			const descIndex = result.findIndex(([k]) => k === "description");
			if (descIndex >= 0) {
				result[descIndex] = ["description", newDesc];
			} else {
				result.push(["description", newDesc]);
			}
		}

		return result;
	},
);

// ============================================================================
// Step 4: Remove unnecessary definitions (from fix-contract-schema.js)
// ============================================================================

export const DEFINITIONS_TO_REMOVE = [
	"Promise",
	"PromiseOrValueArray_of_String",
	"PromiseOrValueBoolean",
	"PromiseOrValueString",
	"AbiHelper",
	"AbiPayloadHelper",
];

export function removeDefinitions(schema: JsonSchema): JsonSchema {
	if (!schema.definitions) {
		return schema;
	}

	const definitions = { ...schema.definitions };
	for (const name of DEFINITIONS_TO_REMOVE) {
		delete definitions[name];
	}

	return { ...schema, definitions };
}

// ============================================================================
// Step 5: Add strict additionalProperties (from fix-contract-schema.js)
// ============================================================================

export const addStrictAdditionalProperties = createSchemaTransformer(
	"addStrictAdditionalProperties",
	(entries, recurse) => {
		const result: [string, unknown][] = entries.map(([key, value]) => [
			key,
			recurse(value),
		]);

		const obj = Object.fromEntries(result);
		if (
			obj.type === "object" &&
			obj.properties &&
			!("additionalProperties" in obj)
		) {
			result.push(["additionalProperties", false]);
		}

		return result;
	},
);

// ============================================================================
// Step 6: Extract discriminated unions (from discr-union.js)
// ============================================================================

export function findDiscriminatorProperty(
	variants: JsonSchema[],
): string | null {
	if (!variants.length) return null;

	const firstVariant = variants[0];
	if (!firstVariant?.properties) return null;

	for (const [propName, propSchema] of Object.entries(
		firstVariant.properties,
	)) {
		if (
			propSchema?.type === "string" &&
			Array.isArray(propSchema?.enum) &&
			propSchema.enum.length === 1
		) {
			const allVariantsMatch = variants.every((variant) => {
				const prop = variant.properties?.[propName];
				return (
					prop?.type === "string" &&
					Array.isArray(prop?.enum) &&
					prop.enum.length === 1
				);
			});

			if (allVariantsMatch) {
				return propName;
			}
		}
	}

	return null;
}

function toSchemaNameSuffix(discriminatorValue: string): string {
	return discriminatorValue
		.replace(/[-_\s]+/g, "_")
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

function getDiscriminatorValue(
	variant: JsonSchema,
	discriminatorProp: string,
	definitions: Record<string, JsonSchema>,
): string | null {
	if (variant.$ref) {
		const refName = variant.$ref.replace("#/definitions/", "");
		const refDef = definitions[refName];
		return getEnumStringValue(refDef?.properties?.[discriminatorProp]);
	}
	return getEnumStringValue(variant.properties?.[discriminatorProp]);
}

export function extractDiscriminatedUnions(schema: JsonSchema): JsonSchema {
	const result = deepClone(schema);
	const newDefinitions: Record<string, JsonSchema> = {};

	for (const [name, definition] of Object.entries(result.definitions ?? {})) {
		if (!definition.oneOf || !Array.isArray(definition.oneOf)) {
			continue;
		}

		const inlineVariants = definition.oneOf.filter(
			(variant) => !variant.$ref && variant.properties,
		);
		const refVariants = definition.oneOf.filter((variant) => variant.$ref);

		let discriminatorProp = findDiscriminatorProperty(inlineVariants);

		if (!discriminatorProp && refVariants.length > 0) {
			const resolvedRefs = refVariants
				.map((v) => {
					if (!v.$ref) {
						throw new Error("Variant has no $ref");
					}
					const refName = v.$ref.replace("#/definitions/", "");
					if (!result.definitions) {
						throw new Error("Definitions not found");
					}
					return result.definitions[refName];
				})
				.filter((v) => v !== undefined);
			discriminatorProp = findDiscriminatorProperty(resolvedRefs);
		}

		if (!discriminatorProp) {
			continue;
		}

		const newOneOf: JsonSchema[] = [];
		const mapping: Record<string, string> = {};

		for (const variant of definition.oneOf) {
			if (variant.$ref) {
				if (!result.definitions) {
					throw new Error("Definitions not found");
				}
				const discriminatorValue = getDiscriminatorValue(
					variant,
					discriminatorProp,
					result.definitions,
				);
				if (discriminatorValue) {
					mapping[discriminatorValue] = variant.$ref;
				}
				newOneOf.push(variant);
				continue;
			}

			const discriminatorValue = getEnumStringValue(
				variant.properties?.[discriminatorProp],
			);

			if (!discriminatorValue) {
				continue;
			}

			const variantName = `${name}${toSchemaNameSuffix(discriminatorValue)}`;
			const refPath = `#/definitions/${variantName}`;

			newDefinitions[variantName] = variant;
			mapping[discriminatorValue] = refPath;
			newOneOf.push({ $ref: refPath });
		}

		definition.oneOf = newOneOf;
		definition.discriminator = {
			propertyName: discriminatorProp,
			mapping,
		};
	}

	result.definitions = {
		...result.definitions,
		...newDefinitions,
	};

	return result;
}

// ============================================================================
// Step 7: Dereference $refs
// ============================================================================

export function dereferenceSchema(schema: JsonSchema): JsonSchema {
	const definitions = schema.definitions ?? {};

	function resolveRef(
		refPath: string,
		visited: Set<string>,
	): Record<string, unknown> {
		const match = refPath.match(/^#\/definitions\/(.+)$/);
		if (!Array.isArray(match)) {
			throw new Error(`Unsupported $ref format: ${refPath}`);
		}
		const defName = match[1];
		if (!defName) {
			throw new Error(`Unsupported $ref format: ${refPath}`);
		}
		if (visited.has(defName)) {
			return { $comment: `Circular reference to ${defName}` };
		}
		const definition = definitions[defName];
		if (!definition) {
			throw new Error(`Definition not found: ${defName}`);
		}
		const newVisited = new Set(visited);
		newVisited.add(defName);
		const result = inlineRefsImpl(deepClone(definition), newVisited);
		if (!isPlainObject(result)) {
			throw new Error(`Expected object after resolving ref ${refPath}`);
		}
		return result;
	}

	function inlineRefsImpl(obj: unknown, visited: Set<string>): unknown {
		if (!isPlainObject(obj)) {
			if (Array.isArray(obj)) {
				return obj.map((item) => inlineRefsImpl(item, visited));
			}
			return obj;
		}

		if (typeof obj.$ref === "string") {
			return resolveRef(obj.$ref, visited);
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = inlineRefsImpl(value, visited);
		}
		return result;
	}

	const result: JsonSchema & { definitions: Record<string, JsonSchema> } = {
		$schema: schema.$schema,
		title: schema.title,
		definitions: {},
	};

	for (const [name, definition] of Object.entries(definitions)) {
		const inlined = inlineRefsImpl(deepClone(definition), new Set([name]));
		assertJsonSchema(inlined, `dereferenceSchema definition ${name}`);
		result.definitions[name] = inlined;
	}

	return result;
}

// ============================================================================
// Step 8: AJV compatibility fixes
// ============================================================================

export const fixNullableTypes = createSchemaTransformer(
	"fixNullableTypes",
	(entries, recurse) => {
		const result: [string, unknown][] = [];
		let addNullable = false;

		for (const [key, value] of entries) {
			if (key === "type") {
				const types = getTypeArray(value);
				if (types && types.length === 2 && types.includes("null")) {
					const nonNullType = types.find((t) => t !== "null");
					result.push(["type", nonNullType]);
					addNullable = true;
				} else {
					result.push([key, value]);
				}
			} else {
				result.push([key, recurse(value)]);
			}
		}

		if (addNullable) {
			result.push(["nullable", true]);
		}

		return result;
	},
);

export const fixDictionaryTypes = createSchemaTransformer(
	"fixDictionaryTypes",
	(entries, recurse) => {
		const result: [string, unknown][] = entries.map(([key, value]) => [
			key,
			recurse(value),
		]);

		const obj = Object.fromEntries(result);
		if (
			obj.type === "object" &&
			obj.additionalProperties &&
			typeof obj.additionalProperties === "object" &&
			!obj.properties &&
			!obj.required
		) {
			result.push(["required", []]);
		}

		return result;
	},
);

function hasNullVariant(variants: unknown[]): boolean {
	return variants.some((v) => isPlainObject(v) && v.type === "null");
}

export function fixOptionalProperties(schema: JsonSchema): JsonSchema {
	function recurse(value: unknown): unknown {
		if (!isPlainObject(value)) {
			if (Array.isArray(value)) {
				return value.map(recurse);
			}
			return value;
		}

		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			result[key] = recurse(val);
		}

		if (
			result.type === "object" &&
			isPlainObject(result.properties) &&
			result.required
		) {
			const requiredSet = new Set(getRequiredArray(result.required));
			const newProperties: Record<string, unknown> = {};

			for (const [propName, propSchema] of Object.entries(result.properties)) {
				if (requiredSet.has(propName) || !isPlainObject(propSchema)) {
					newProperties[propName] = propSchema;
					continue;
				}

				// For optional properties with oneOf/anyOf, add {type: "null"} variant
				// unless it already has one (from Rust Option<T> conversion)
				if (propSchema.oneOf && Array.isArray(propSchema.oneOf)) {
					if (hasNullVariant(propSchema.oneOf)) {
						newProperties[propName] = propSchema;
					} else {
						newProperties[propName] = {
							...propSchema,
							oneOf: [...propSchema.oneOf, { type: "null" }],
						};
					}
				} else if (propSchema.anyOf && Array.isArray(propSchema.anyOf)) {
					if (hasNullVariant(propSchema.anyOf)) {
						newProperties[propName] = propSchema;
					} else {
						newProperties[propName] = {
							...propSchema,
							anyOf: [...propSchema.anyOf, { type: "null" }],
						};
					}
				} else if (typeof propSchema.type === "string" && !propSchema.allOf) {
					// For scalar types, add nullable: true
					newProperties[propName] = { ...propSchema, nullable: true };
				} else {
					newProperties[propName] = propSchema;
				}
			}

			result.properties = newProperties;
		}

		return result;
	}

	const result = recurse(schema);
	assertJsonSchema(result, "fixOptionalProperties");
	return result;
}

export const flattenAllOf = createSchemaTransformer(
	"flattenAllOf",
	(entries, recurse) => {
		const result: [string, unknown][] = [];

		for (const [key, value] of entries) {
			if (key === "allOf" && Array.isArray(value) && value.length === 1) {
				const inner = recurse(value[0]);
				if (isPlainObject(inner)) {
					for (const [innerKey, innerValue] of Object.entries(inner)) {
						if (!result.some(([k]) => k === innerKey)) {
							result.push([innerKey, innerValue]);
						}
					}
				}
			} else {
				result.push([key, recurse(value)]);
			}
		}

		return result;
	},
);

export const fixAnyOfNullable = createSchemaTransformer(
	"fixAnyOfNullable",
	(entries, recurse) => {
		const result: [string, unknown][] = [];

		for (const [key, value] of entries) {
			if (key === "anyOf" && Array.isArray(value) && value.length === 2) {
				const nullVariant = value.find(
					(v) => isPlainObject(v) && v.type === "null",
				);
				const nonNullVariant = value.find(
					(v) => isPlainObject(v) && v.type !== "null",
				);

				if (nullVariant && nonNullVariant && isPlainObject(nonNullVariant)) {
					const fixed = recurse(nonNullVariant);
					if (!isPlainObject(fixed)) {
						result.push([key, recurse(value)]);
						continue;
					}

					// If non-null variant has oneOf, add {type: "null"} to the oneOf array
					// See: https://github.com/ajv-validator/ajv/issues/2450
					if (Array.isArray(fixed.oneOf)) {
						for (const [k, v] of Object.entries(fixed)) {
							if (k === "oneOf" && Array.isArray(v)) {
								result.push([k, [...v, { type: "null" }]]);
							} else {
								result.push([k, v]);
							}
						}
						continue;
					}

					// For simple types, use nullable: true
					for (const [k, v] of Object.entries(fixed)) {
						result.push([k, v]);
					}
					if (typeof nonNullVariant.type === "string") {
						result.push(["nullable", true]);
					}
					continue;
				}
			}
			result.push([key, recurse(value)]);
		}

		return result;
	},
);

/**
 * Remove discriminator from dereferenced schema.
 * The discriminator keyword was added for OpenAPI tooling but AJV's implementation
 * has strict requirements that don't match our schema. oneOf validation works without it.
 */
export const removeDiscriminator = createSchemaTransformer(
	"removeDiscriminator",
	(entries, recurse) =>
		entries
			.filter(([key]) => key !== "discriminator")
			.map(([key, value]) => [key, recurse(value)]),
);

function applyAjvFixes(schema: JsonSchema): JsonSchema {
	let result = schema;
	result = fixNullableTypes(result);
	result = fixDictionaryTypes(result);
	result = fixOptionalProperties(result);
	result = flattenAllOf(result);
	result = fixAnyOfNullable(result);
	return result;
}

// ============================================================================
// Step 9: Add custom type definitions
// These are added BEFORE type generation so they appear in index.ts
// ============================================================================

/**
 * Creates a Pick<T, K> schema from an existing schema.
 * Only includes the specified properties in the result.
 */
function pickSchemaProperties(schema: JsonSchema, keys: string[]): JsonSchema {
	const keySet = new Set(keys);
	const pickedProperties: Record<string, JsonSchema> = {};

	if (schema.properties) {
		for (const key of keys) {
			const prop = schema.properties[key];
			if (prop) {
				pickedProperties[key] = prop;
			}
		}
	}

	const pickedRequired = getRequiredArray(schema.required).filter((r) =>
		keySet.has(r),
	);

	return {
		type: "object",
		required: pickedRequired,
		properties: pickedProperties,
		additionalProperties: false,
	};
}

/**
 * Resolves a $ref or returns the schema directly.
 */
function resolveVariant(
	variant: JsonSchema,
	definitions: Record<string, JsonSchema>,
): JsonSchema | undefined {
	if (variant.$ref) {
		const refName = variant.$ref.replace("#/definitions/", "");
		return definitions[refName];
	}
	return variant;
}

/**
 * Gets the standard name from a MultiPayload variant.
 */
function getVariantStandard(
	variant: JsonSchema,
	definitions: Record<string, JsonSchema>,
): string | null {
	const resolved = resolveVariant(variant, definitions);
	return getEnumStringValue(resolved?.properties?.standard);
}

/**
 * Creates a ParsedJson<T> wrapper schema: { original: string, parsed: T }
 * This represents a JSON string that has been parsed, keeping both the original and parsed values.
 */
function createParsedJsonWrapper(parsedSchema: JsonSchema): JsonSchema {
	return {
		type: "object",
		required: ["original", "parsed"],
		additionalProperties: false,
		properties: {
			original: { type: "string" },
			parsed: parsedSchema,
		},
	};
}

/**
 * Creates a __Parsed variant schema where string fields that will have parseJson
 * are replaced with ParsedJson<T> wrapper types: { original: string, parsed: T }
 * Also adds any necessary helper definitions (like Nep413Payload__Parsed).
 */
function createParsedVariant(
	variant: JsonSchema,
	standard: string,
	definitions: Record<string, JsonSchema>,
): JsonSchema {
	const parsed = deepClone(variant);

	if (standard === "nep413") {
		// nep413: payload.message: string → { original: string, parsed: Nep413DefusePayload }
		const nep413ParsedName = `Nep413Payload${PARSED_SUFFIX}`;
		const nep413Payload = definitions.Nep413Payload;
		if (nep413Payload && !definitions[nep413ParsedName]) {
			definitions[nep413ParsedName] = {
				...deepClone(nep413Payload),
				properties: {
					...nep413Payload.properties,
					message: createParsedJsonWrapper({
						$ref: "#/definitions/Nep413DefusePayload",
					}),
				},
			};
		}
		if (parsed.properties?.payload) {
			parsed.properties.payload = {
				$ref: `#/definitions/${nep413ParsedName}`,
			};
		}
	} else if (standard === "ton_connect") {
		// ton_connect: payload.text: string → { original: string, parsed: DefusePayload }
		const tonConnectParsedName = `TonConnectPayloadSchema${PARSED_SUFFIX}`;
		const tonConnectPayload = definitions.TonConnectPayloadSchema;

		if (tonConnectPayload?.oneOf && !definitions[tonConnectParsedName]) {
			const parsedOneOf = tonConnectPayload.oneOf.map((payloadVariant) => {
				const resolved = resolveVariant(payloadVariant, definitions);
				if (!resolved) return payloadVariant;

				const typeValue = getEnumStringValue(resolved.properties?.type);
				if (typeValue === "text" && resolved.properties?.text) {
					return {
						...deepClone(resolved),
						properties: {
							...resolved.properties,
							text: createParsedJsonWrapper({
								$ref: "#/definitions/DefusePayload_for_DefuseIntents",
							}),
						},
					};
				}
				return payloadVariant;
			});

			definitions[tonConnectParsedName] = { oneOf: parsedOneOf };
		}

		if (parsed.properties?.payload) {
			parsed.properties.payload = {
				$ref: `#/definitions/${tonConnectParsedName}`,
			};
		}
	} else if (
		SIMPLE_PAYLOAD_STANDARDS.includes(
			standard as (typeof SIMPLE_PAYLOAD_STANDARDS)[number],
		) &&
		parsed.properties?.payload
	) {
		// These standards: payload: string → { original: string, parsed: DefusePayload }
		parsed.properties.payload = createParsedJsonWrapper({
			$ref: "#/definitions/DefusePayload_for_DefuseIntents",
		});
	}

	return parsed;
}

/**
 * Adds custom type definitions to the schema.
 * - Nep413DefusePayload: Pick<DefusePayload, "deadline" | "signer_id" | "intents">
 * - MultiPayloadNarrowed: Pick<variant, "standard" | "payload"> for each MultiPayload variant
 * - *__Parsed variants: versions with parsed payload types instead of strings
 *
 * Must be called BEFORE type generation and BEFORE dereferencing.
 * Works with schemas that have $refs.
 */
export function addCustomDefinitions(schema: JsonSchema): JsonSchema {
	const result = deepClone(schema);
	const definitions = result.definitions;
	const multiPayload = definitions?.MultiPayload;
	const defusePayload = definitions?.DefusePayload_for_DefuseIntents;

	if (!definitions || !multiPayload?.oneOf || !defusePayload) {
		return result;
	}

	// Add Nep413DefusePayload = Pick<DefusePayload, "deadline" | "signer_id" | "intents">
	definitions.Nep413DefusePayload = pickSchemaProperties(defusePayload, [
		"deadline",
		"signer_id",
		"intents",
	]);

	// Process each variant to create:
	// 1. MultiPayloadNarrowed variants (Pick<variant, "standard" | "payload">)
	// 2. __Parsed variants (with parsed payload types)
	// 3. MultiPayloadNarrowed__Parsed variants
	const narrowedVariants: JsonSchema[] = [];
	const parsedVariantRefs: JsonSchema[] = [];
	const narrowedParsedVariants: JsonSchema[] = [];

	for (const variant of multiPayload.oneOf) {
		const resolved = resolveVariant(variant, definitions);
		if (!resolved) continue;

		const standard = getVariantStandard(variant, definitions);
		if (!standard) continue;

		const variantName = variant.$ref?.replace("#/definitions/", "") ?? null;
		const standardProps = resolved.properties?.standard;
		const payloadProps = resolved.properties?.payload;

		if (standardProps == null || payloadProps == null) continue;

		// 1. Add to MultiPayloadNarrowed
		narrowedVariants.push({
			type: "object",
			required: ["standard", "payload"],
			additionalProperties: false,
			properties: { standard: standardProps, payload: payloadProps },
		});

		// 2. Create Parsed variant definition
		if (variantName) {
			const parsedVariantName = `${variantName}${PARSED_SUFFIX}`;
			const parsedVariant = createParsedVariant(
				resolved,
				standard,
				definitions,
			);
			definitions[parsedVariantName] = parsedVariant;
			parsedVariantRefs.push({ $ref: `#/definitions/${parsedVariantName}` });

			// 3. Add to MultiPayloadNarrowed Parsed
			const parsedPayload = parsedVariant.properties?.payload ?? {
				$ref: "#/definitions/DefusePayload_for_DefuseIntents",
			};
			narrowedParsedVariants.push({
				type: "object",
				required: ["standard", "payload"],
				additionalProperties: false,
				properties: { standard: standardProps, payload: parsedPayload },
			});
		}
	}

	// Add union types
	definitions.MultiPayloadNarrowed = { oneOf: narrowedVariants };
	definitions[`MultiPayload${PARSED_SUFFIX}`] = { oneOf: parsedVariantRefs };
	definitions[`MultiPayloadNarrowed${PARSED_SUFFIX}`] = {
		oneOf: narrowedParsedVariants,
	};

	return result;
}

// ============================================================================
// Step 10: Add parseJson keyword for validation
// This is added AFTER dereferencing, for AJV validation only
// ============================================================================

/**
 * Transforms a oneOf variant to add parseJson keyword to payload fields.
 */
function addParseJsonToVariant(
	variant: JsonSchema,
	defusePayloadSchema: JsonSchema,
	nep413PayloadSchema: JsonSchema,
): JsonSchema {
	const props = variant.properties;
	const standardEnum = props?.standard?.enum;
	const standard = standardEnum?.[0];

	if (standard === "nep413" && props?.payload?.properties?.message) {
		const message = props.payload.properties.message;
		return {
			...variant,
			properties: {
				...props,
				payload: {
					...props.payload,
					properties: {
						...props.payload.properties,
						message: { ...message, parseJson: nep413PayloadSchema },
					},
				},
			},
		};
	}

	if (standard === "ton_connect" && props?.payload?.oneOf) {
		return {
			...variant,
			properties: {
				...props,
				payload: {
					...props.payload,
					oneOf: props.payload.oneOf.map((payloadVariant: JsonSchema) => {
						const typeEnum = payloadVariant.properties?.type?.enum;
						if (typeEnum?.[0] === "text") {
							const text = payloadVariant.properties?.text;
							return {
								...payloadVariant,
								properties: {
									...payloadVariant.properties,
									text: { ...text, parseJson: defusePayloadSchema },
								},
							};
						}
						return payloadVariant;
					}),
				},
			},
		};
	}

	if (
		SIMPLE_PAYLOAD_STANDARDS.includes(
			standard as (typeof SIMPLE_PAYLOAD_STANDARDS)[number],
		) &&
		props?.payload
	) {
		return {
			...variant,
			properties: {
				...props,
				payload: { ...props.payload, parseJson: defusePayloadSchema },
			},
		};
	}

	return variant;
}

/**
 * Adds parseJson keyword to MultiPayload and MultiPayloadNarrowed definitions
 * to parse JSON string payloads.
 * The parseJson value contains the schema to validate the parsed JSON against.
 * - nep413: uses Nep413DefusePayload schema inline
 * - other standards: use full DefusePayload_for_DefuseIntents schema inline
 *
 * IMPORTANT: MultiPayloadNarrowed must ALWAYS be kept in sync with MultiPayload.
 * It's Pick<MultiPayload, "standard" | "payload"> - exactly the same validation
 * logic, just without signature/public_key fields. Both need parseJson for the
 * same payload fields.
 *
 * Must be called AFTER dereferencing on the validation schema.
 */
export function addParseJsonKeywords(schema: JsonSchema): JsonSchema {
	const result = deepClone(schema);
	const defusePayloadSchema =
		result.definitions?.DefusePayload_for_DefuseIntents;
	const nep413PayloadSchema = result.definitions?.Nep413DefusePayload;

	if (!defusePayloadSchema || !nep413PayloadSchema) {
		return result;
	}

	// Add parseJson to MultiPayload variants.
	// parseJson is a custom AJV keyword that parses JSON string payloads at runtime.
	const multiPayload = result.definitions?.MultiPayload;
	if (multiPayload?.oneOf && Array.isArray(multiPayload.oneOf)) {
		multiPayload.oneOf = multiPayload.oneOf.map((variant) =>
			addParseJsonToVariant(variant, defusePayloadSchema, nep413PayloadSchema),
		);
	}

	// Add parseJson to MultiPayloadNarrowed variants.
	// MUST be kept in sync with MultiPayload - same parseJson logic for payload fields.
	const multiPayloadNarrowed = result.definitions?.MultiPayloadNarrowed;
	if (
		multiPayloadNarrowed?.oneOf &&
		Array.isArray(multiPayloadNarrowed.oneOf)
	) {
		multiPayloadNarrowed.oneOf = multiPayloadNarrowed.oneOf.map((variant) =>
			addParseJsonToVariant(variant, defusePayloadSchema, nep413PayloadSchema),
		);
	}

	return result;
}

// ============================================================================
// Step 9: Generate TypeScript
// ============================================================================

function schemaNameToTypeName(schemaName: string): string {
	return schemaName
		.replace(/_for_/g, "For_")
		.replace(/\(/g, "")
		.replace(/\)/g, "");
}

/**
 * Checks if a schema or any nested schema contains parseJson keyword.
 */
function schemaHasParseJson(schema: unknown): boolean {
	if (!isPlainObject(schema)) {
		if (Array.isArray(schema)) {
			return schema.some(schemaHasParseJson);
		}
		return false;
	}
	if ("parseJson" in schema) return true;
	return Object.values(schema).some(schemaHasParseJson);
}

/**
 * Checks if a definition name is a Parsed variant (type-only, no schema export needed).
 * Parsed variants are generated for types that have parseJson - they represent the
 * output type after JSON string fields are parsed into objects.
 */
function isParsedTypeDefinition(name: string): boolean {
	return name.endsWith(PARSED_SUFFIX);
}

/**
 * Generates type-check-schemas.ts content.
 * This file provides compile-time type checking but is NOT included in the bundle.
 *
 * @param cleanSchema - Schema WITHOUT parseJson keyword (for JSONSchemaType exports)
 * @param validationSchema - Schema WITH parseJson keyword (for runtime validators)
 */
function generateTypeCheckSchemas(
	cleanSchema: JsonSchema,
	validationSchema: JsonSchema,
): string {
	const cleanDefinitions = cleanSchema.definitions ?? {};
	const validationDefinitions = validationSchema.definitions ?? {};
	const definitionNames = Object.keys(cleanDefinitions).filter(
		(name) => !isParsedTypeDefinition(name),
	);

	// Identify schemas that have parseJson in their validation schema
	const schemasWithParseJson = new Set<string>();
	for (const name of definitionNames) {
		const schema = validationDefinitions[name];
		if (schema && schemaHasParseJson(schema)) {
			schemasWithParseJson.add(name);
		}
	}

	const schemaExports = definitionNames
		.map((name) => {
			const typeName = schemaNameToTypeName(name);
			const hasParseJson = schemasWithParseJson.has(name);
			const schema = hasParseJson
				? validationDefinitions[name]
				: cleanDefinitions[name];
			const schemaJson = JSON.stringify(schema);

			if (!schema) {
				throw new Error(`Schema not found: ${name}`);
			}

			const incompatibleReason = JSONSCHEMATYPE_INCOMPATIBLE[name];
			if (incompatibleReason) {
				return `// Cast allowed here due to AJV v8 limitation: ${incompatibleReason}
// See: https://github.com/ajv-validator/ajv/issues/2132
export const ${typeName}Schema = ${schemaJson} as unknown as JSONSchemaType<Types.${typeName}>;`;
			}

			if (hasParseJson) {
				return `// ${typeName}Schema is type-checked against the unparsed type, then exported as the Parsed type.
// This is correct because parseJson transforms string payloads into objects at runtime.
const _${typeName}SchemaCheck: JSONSchemaType<Types.${typeName}> = ${schemaJson};
export const ${typeName}Schema = _${typeName}SchemaCheck as unknown as JSONSchemaType<Types.${typeName}${PARSED_SUFFIX}>;`;
			}

			return `export const ${typeName}Schema: JSONSchemaType<Types.${typeName}> = ${schemaJson};`;
		})
		.join("\n\n");

	return `/**
 * This file was automatically generated by gen-defuse-types.ts.
 * DO NOT MODIFY IT BY HAND.
 *
 * This file provides compile-time type checking for schemas using JSONSchemaType.
 * It is NOT included in the bundle - it's only used during development for type safety.
 * The actual runtime validation uses validate.ts which has optimized JSON.parse loading.
 */

import type { JSONSchemaType } from "ajv";
import type * as Types from "./index.js";

${schemaExports}
`;
}

/**
 * Generates validate.ts content with optimized JSON.parse loading.
 * All schemas are stored in a single JSON string for fast parsing.
 *
 * @param cleanSchema - Schema WITHOUT parseJson keyword
 * @param validationSchema - Schema WITH parseJson keyword (for runtime validators)
 */
function generateValidateTs(
	cleanSchema: JsonSchema,
	validationSchema: JsonSchema,
): string {
	const cleanDefinitions = cleanSchema.definitions ?? {};
	const validationDefinitions = validationSchema.definitions ?? {};
	const definitionNames = Object.keys(cleanDefinitions).filter(
		(name) => !isParsedTypeDefinition(name),
	);

	// Identify schemas that have parseJson in their validation schema
	const schemasWithParseJson = new Set<string>();
	for (const name of definitionNames) {
		const schema = validationDefinitions[name];
		if (schema && schemaHasParseJson(schema)) {
			schemasWithParseJson.add(name);
		}
	}

	// Build the schemas object for JSON.parse
	const schemasObject: Record<string, unknown> = {};
	for (const name of definitionNames) {
		const typeName = schemaNameToTypeName(name);
		const hasParseJson = schemasWithParseJson.has(name);
		const schema = hasParseJson
			? validationDefinitions[name]
			: cleanDefinitions[name];
		schemasObject[typeName] = schema;
	}

	const schemasJsonString = JSON.stringify(JSON.stringify(schemasObject));

	// Generate validator exports
	const validators = definitionNames.map((name) => {
		const typeName = schemaNameToTypeName(name);
		const hasParseJson = schemasWithParseJson.has(name);
		const inputType = `Types.${typeName}`;
		const outputType = hasParseJson
			? `Types.${typeName}${PARSED_SUFFIX}`
			: `Types.${typeName}`;

		const compileCall = `() => ajv.compile(schemas.${typeName} as JSONSchemaType<${outputType}>)`;

		if (hasParseJson) {
			return `export const ${typeName}Validator = wrapValidator<${inputType}, ${outputType}>(${compileCall}, true);`;
		}
		return `export const ${typeName}Validator = wrapValidator<${inputType}, ${outputType}>(${compileCall});`;
	});

	return `/**
 * This file was automatically generated by gen-defuse-types.ts.
 * DO NOT MODIFY IT BY HAND.
 *
 * This file uses JSON.parse for fast schema loading (~1.5-2x faster than JS object literals).
 * For compile-time type checking, see type-check-schemas.ts (not included in bundle).
 */

import Ajv, { type JSONSchemaType } from "ajv";
import type { DataValidationCxt } from "ajv/dist/types";
import addFormats from "ajv-formats";
import type * as Types from "./index.js";
import { wrapValidator } from "./standard-schema.js";

// All schemas in a single JSON string for fast parsing
const schemas = JSON.parse(${schemasJsonString});

export const ajv = new Ajv({
	formats: {
		// Rust/schemars formats - ignore validation but allow in schema
		uint32: true,
		int64: true,
	},
});
addFormats(ajv);

// parseJson keyword for parsing JSON string payloads in MultiPayload.
// The keyword value is the schema to validate the parsed JSON against.
// Replaces the string with { original: string, parsed: T } object.
ajv.addKeyword({
	keyword: "parseJson",
	modifying: true,
	schema: true,
	validate: function validateParseJson(
		schema: Record<string, unknown>,
		data: unknown,
		_parentSchema: unknown,
		dataCtx?: DataValidationCxt,
	): boolean {
		if (typeof data !== "string" || !dataCtx) return true;

		try {
			const parsed: unknown = JSON.parse(data);
			const isValid = ajv.validate(schema, parsed);
			if (isValid) {
				dataCtx.parentData[dataCtx.parentDataProperty] = {
					original: data,
					parsed,
				};
			}
			return isValid;
		} catch {
			return false;
		}
	},
});

${validators.join("\n")}

export type {
	StandardSchemaV1,
	ValidationResult,
	ValidationIssue,
	Validator,
	InferInput,
	InferOutput,
} from "./standard-schema.js";
`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
	const abiPath = path.resolve(
		import.meta.dirname,
		"../artifacts/defuse_contract_abi.json",
	);
	const typesOutputPath = path.resolve(import.meta.dirname, "../src/index.ts");
	const schemaOutputPath = path.resolve(
		import.meta.dirname,
		"../schemas/intents.schema.json",
	);
	const validateOutputPath = path.resolve(
		import.meta.dirname,
		"../src/validate.ts",
	);
	const typeCheckSchemasOutputPath = path.resolve(
		import.meta.dirname,
		"../src/type-check-schemas.ts",
	);

	// ==========================================================================
	// PHASE 1: Build schema for TypeScript type generation
	// ==========================================================================

	// Step 1: Read and extract schema from ABI
	const abi: AbiJson = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
	let typesSchema = extractSchemaFromAbi(abi);

	// Validate schema before processing
	validateRequiredDefinitions(typesSchema);
	validateSchemaStandards(typesSchema);
	warnAboutMissingDefinitionsToRemove(typesSchema);
	warnAboutObsoleteIncompatibleTypes(typesSchema, JSONSCHEMATYPE_INCOMPATIBLE);

	// Step 2: Remove unused definitions
	typesSchema = removeDefinitions(typesSchema);

	// Step 3: Fix WebAuthn anyOf structure (expand properties with anyOf)
	typesSchema = expandPropertiesWithAnyOf(typesSchema);

	// Step 4: Extract discriminated unions (creates variant definitions like MultiPayloadNep413)
	typesSchema = extractDiscriminatedUnions(typesSchema);

	// Step 5: Add strict additionalProperties: false to all object types
	// This prevents json-schema-to-typescript from adding [k: string]: unknown index signatures
	typesSchema = addStrictAdditionalProperties(typesSchema);

	// Step 6: Add custom type definitions (Nep413DefusePayload, MultiPayloadNarrowed, *Parsed)
	typesSchema = addCustomDefinitions(typesSchema);

	// Step 7: Generate TypeScript types
	// NOTE: Types are generated from schema with $refs intact (not dereferenced).
	// This schema only has definition additions, no structural modifications.
	let typesContent = await compile(typesSchema, "NEARIntentsSchema", {
		unreachableDefinitions: true,
		bannerComment: `/**
 * This file was automatically generated by gen-defuse-types.ts.
 * DO NOT MODIFY IT BY HAND.
 */`,
	});

	// Step 7b: Generate and append IntentStandardEnum
	const standards = extractStandardsFromSchema(typesSchema);
	typesContent += generateIntentStandardEnum(standards);

	fs.writeFileSync(typesOutputPath, typesContent);
	// biome-ignore lint/suspicious/noConsole: it's a script so it's ok
	console.log(`TypeScript types written to ${typesOutputPath}`);

	// ==========================================================================
	// PHASE 2: Build schema for JSON Schema output and AJV validation
	// ==========================================================================

	// Step 8: Apply structural transformations for validation
	let validationSchema = deepClone(typesSchema);
	// Note: expandPropertiesWithAnyOf, addStrictAdditionalProperties already applied in PHASE 1
	validationSchema = moveContentEncodingToDescription(validationSchema);

	// Step 9: Dereference schema (inline all $refs) - this goes LAST for structural changes
	validationSchema = dereferenceSchema(validationSchema);
	validationSchema = removeDiscriminator(validationSchema);

	// Step 10: Apply AJV fixes for runtime validation
	// This creates the "clean" schema without parseJson (for JSONSchemaType exports)
	const cleanSchema = applyAjvFixes(validationSchema);

	// Step 11: Add parseJson keywords for AJV validation
	// This creates the validation schema with parseJson (for MultiPayload validator)
	validationSchema = addParseJsonKeywords(validationSchema);

	// Step 12: Write JSON schema (includes parseJson)
	fs.writeFileSync(
		schemaOutputPath,
		JSON.stringify(validationSchema, null, "\t"),
	);
	// biome-ignore lint/suspicious/noConsole: it's a script so it's ok
	console.log(`JSON schema written to ${schemaOutputPath}`);

	// Step 13: Apply AJV fixes to validation schema too
	const ajvFixedValidationSchema = applyAjvFixes(validationSchema);

	// Generate type-check-schemas.ts (for compile-time type checking, not bundled)
	const typeCheckSchemasContent = generateTypeCheckSchemas(
		cleanSchema,
		ajvFixedValidationSchema,
	);
	fs.writeFileSync(typeCheckSchemasOutputPath, typeCheckSchemasContent);
	// biome-ignore lint/suspicious/noConsole: it's a script so it's ok
	console.log(`Type-check schemas written to ${typeCheckSchemasOutputPath}`);

	// Generate validate.ts with optimized JSON.parse loading
	const validateContent = generateValidateTs(
		cleanSchema,
		ajvFixedValidationSchema,
	);
	fs.writeFileSync(validateOutputPath, validateContent);
	// biome-ignore lint/suspicious/noConsole: it's a script so it's ok
	console.log(`AJV validators written to ${validateOutputPath}`);

	// Format generated files with biome
	execSync(
		`pnpm biome format --write ${typesOutputPath} ${schemaOutputPath} ${validateOutputPath} ${typeCheckSchemasOutputPath}`,
		{
			stdio: "inherit",
		},
	);
}

main().catch((err: unknown) => {
	// biome-ignore lint/suspicious/noConsole: it's a script so it's ok
	console.error(err);
	// biome-ignore lint/style/noRestrictedGlobals: it's a script so it's ok
	process.exit(1);
});

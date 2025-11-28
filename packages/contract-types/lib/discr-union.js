/**
 * Pre-processes JSON Schema to transform inline oneOf variants into named $ref definitions.
 * This enables proper discriminated union handling when converting to OpenAPI.
 *
 * Before:
 * {
 *   "Intent": {
 *     "oneOf": [
 *       { "properties": { "intent": { "enum": ["add_public_key"] }, ... } },
 *       { "properties": { "intent": { "enum": ["transfer"] }, ... } }
 *     ]
 *   }
 * }
 *
 * After:
 * {
 *   "Intent": {
 *     "oneOf": [
 *       { "$ref": "#/definitions/IntentAddPublicKey" },
 *       { "$ref": "#/definitions/IntentTransfer" }
 *     ],
 *     "discriminator": {
 *       "propertyName": "intent",
 *       "mapping": {
 *         "add_public_key": "#/definitions/IntentAddPublicKey",
 *         "transfer": "#/definitions/IntentTransfer"
 *       }
 *     }
 *   },
 *   "IntentAddPublicKey": { "properties": { "intent": { "enum": ["add_public_key"] }, ... } },
 *   "IntentTransfer": { "properties": { "intent": { "enum": ["transfer"] }, ... } }
 * }
 */

/**
 * Finds the discriminator property in a oneOf schema.
 * A discriminator is a string property that has a single-value enum in all variants.
 */
function findDiscriminatorProperty(variants) {
	if (!variants.length) return null;

	const firstVariant = variants[0];
	if (!firstVariant?.properties) return null;

	for (const [propName, propSchema] of Object.entries(
		firstVariant.properties,
	)) {
		// Check if this property has a single-value string enum
		if (propSchema?.type === "string" && propSchema?.enum?.length === 1) {
			// Verify all variants have this property with a single-value enum
			const allVariantsMatch = variants.every((variant) => {
				const prop = variant.properties?.[propName];
				return prop?.type === "string" && prop?.enum?.length === 1;
			});

			if (allVariantsMatch) {
				return propName;
			}
		}
	}

	return null;
}

/**
 * Converts a discriminator value to a valid schema name suffix.
 * e.g., "add_public_key" becomes "AddPublicKey"
 */
function toSchemaNameSuffix(discriminatorValue) {
	return discriminatorValue
		.replace(/[-_\s]+/g, "_") // normalize separators
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("");
}

/**
 * Extracts the discriminator value from a variant, handling both inline schemas and $refs.
 */
function getDiscriminatorValue(variant, discriminatorProp, definitions) {
	if ("$ref" in variant) {
		const refName = variant.$ref.replace("#/definitions/", "");
		const refDef = definitions[refName];
		return refDef?.properties?.[discriminatorProp]?.enum?.[0] ?? null;
	}
	return variant.properties?.[discriminatorProp]?.enum?.[0] ?? null;
}

/**
 * Pre-processes a JSON Schema to extract inline oneOf variants into named definitions.
 * This creates a new schema object without modifying the original.
 */
export function extractDiscriminatedUnions(schema) {
	// Deep clone the schema to avoid mutations
	const result = structuredClone(schema);
	const newDefinitions = {};

	// Process each definition
	for (const [name, definition] of Object.entries(result.definitions)) {
		const def = definition;

		// Check if this is a oneOf schema with inline variants
		if (!def.oneOf || !Array.isArray(def.oneOf)) {
			continue;
		}

		// Separate inline variants and $refs
		const inlineVariants = def.oneOf.filter(
			(variant) => !("$ref" in variant) && variant.properties,
		);
		const refVariants = def.oneOf.filter((variant) => "$ref" in variant);

		// Find the discriminator property from inline variants, or from referenced definitions
		let discriminatorProp = findDiscriminatorProperty(inlineVariants);

		// If no inline variants or couldn't find discriminator, try from existing $refs
		if (!discriminatorProp && refVariants.length > 0) {
			const resolvedRefs = refVariants
				.map((v) => {
					const refName = v.$ref.replace("#/definitions/", "");
					return result.definitions[refName];
				})
				.filter(Boolean);
			discriminatorProp = findDiscriminatorProperty(resolvedRefs);
		}

		if (!discriminatorProp) {
			continue;
		}

		// Build the new oneOf array and mapping
		const newOneOf = [];
		const mapping = {};

		for (const variant of def.oneOf) {
			// Handle existing $ref variants
			if ("$ref" in variant) {
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

			const discriminatorValue =
				variant.properties?.[discriminatorProp]?.enum?.[0];

			if (!discriminatorValue) {
				continue;
			}

			// Create the variant definition name
			const variantName = `${name}${toSchemaNameSuffix(discriminatorValue)}`;
			const refPath = `#/definitions/${variantName}`;

			// Add the variant as a new definition
			newDefinitions[variantName] = variant;

			// Add to mapping
			mapping[discriminatorValue] = refPath;

			// Replace inline variant with $ref
			newOneOf.push({ $ref: refPath });
		}

		// Update the original definition to use $refs and add discriminator with mapping
		def.oneOf = newOneOf;
		def.discriminator = {
			propertyName: discriminatorProp,
			mapping,
		};
	}

	// Merge new definitions into the schema
	result.definitions = {
		...result.definitions,
		...newDefinitions,
	};

	return result;
}

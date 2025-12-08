#!/usr/bin/env node
/** biome-ignore-all lint/suspicious/noConsole: build-time script */
/** biome-ignore-all lint/style/noRestrictedGlobals: build-time script, not client code */

import { extractDiscriminatedUnions } from "./discr-union.js";

function removeContentEncoding(schema) {
	if (schema === null || typeof schema !== "object") {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => removeContentEncoding(item));
	}

	const result = {};

	for (const [key, value] of Object.entries(schema)) {
		if (key === "contentEncoding") {
			// remove the property
		} else {
			result[key] = removeContentEncoding(value);
		}
	}

	return result;
}

function removeDefinitions(schema, names) {
	if (!schema.definitions) {
		return schema;
	}

	const definitions = { ...schema.definitions };
	for (const name of names) {
		delete definitions[name];
	}

	return { ...schema, definitions };
}

function addStrictAdditionalProperties(schema) {
	if (schema === null || typeof schema !== "object") {
		return schema;
	}

	if (Array.isArray(schema)) {
		return schema.map((item) => addStrictAdditionalProperties(item));
	}

	const result = {};

	for (const [key, value] of Object.entries(schema)) {
		result[key] = addStrictAdditionalProperties(value);
	}

	if (
		result.type === "object" &&
		result.properties &&
		!("additionalProperties" in result)
	) {
		result.additionalProperties = false;
	}

	return result;
}

async function transformSchema(schema) {
	let result = schema;
	result = removeContentEncoding(result);
	result = removeDefinitions(result, [
		"Promise",
		"PromiseOrValueArray_of_String",
		"PromiseOrValueBoolean",
		"PromiseOrValueString",
		"AbiHelper",
		"AbiPayloadHelper",
	]);
	result = addStrictAdditionalProperties(result);
	result = extractDiscriminatedUnions(result);
	return result;
}

async function main() {
	const chunks = [];
	for await (const chunk of process.stdin) {
		chunks.push(chunk);
	}
	const input = Buffer.concat(chunks).toString("utf8");
	const schema = JSON.parse(input);
	const result = await transformSchema(schema);
	console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
	console.error(err.message);
	process.exit(1);
});

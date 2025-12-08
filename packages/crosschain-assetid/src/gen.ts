// biome-ignore lint/style/noRestrictedImports: build-time script, not client code
import { mkdirSync, writeFileSync } from "node:fs";
// biome-ignore lint/style/noRestrictedImports: build-time script, not client code
import { dirname } from "node:path";

// ---- Readable regex parts ----
const UC = {
	// RFC3986 unreserved + encodeURIComponent output (plus %HH)
	uriComponent: String.raw`(?:[A-Za-z0-9\-_.!~*'()]|%[0-9A-Fa-f]{2})+`,
	chain: String.raw`[a-z0-9][a-z0-9-]*`,
	namespace: String.raw`[a-z][a-z0-9-]*`,
};

// Final ID grammar: 1cs_v1:<chain>:<namespace>:<reference>[:<selector>]
const STRING_PATTERN = String.raw`^1cs_v1:${UC.chain}:${UC.namespace}:${UC.uriComponent}(?::${UC.uriComponent})?$`;

// sanity-compile
new RegExp(STRING_PATTERN);

// ---- Compose schemas ----
const stringSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://example.com/1cs_v1-string.schema.json",
	title: "1cs_v1 asset ID (string, URI-component encoding)",
	type: "string",
	$defs: {
		uriComponent: { type: "string", pattern: `^${UC.uriComponent}$` },
		chain: { type: "string", pattern: `^${UC.chain}$` },
		namespace: { type: "string", pattern: `^${UC.namespace}$` },
	},
	// inlined pattern for maximum portability
	pattern: STRING_PATTERN,
	examples: [
		"1cs_v1:eth:erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		"1cs_v1:eth-sepolia:erc721:0xAbcDEF1234567890abcdef1234567890ABCDef12:42",
		"1cs_v1:near:near-nft:apes.coolnft.near:series.1%3Ablue%2F42",
		"1cs_v1:aptos:aptos-coin:0x1%3A%3Aaptos_coin%3A%3AAptosCoin",
		"1cs_v1:fiat:iso4217:EUR",
	],
};

const objectSchema = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: "https://example.com/1cs_v1-object.schema.json",
	title: "1cs_v1 asset (object form, encodeURIComponent on stringify)",
	type: "object",
	additionalProperties: false,
	properties: {
		version: { const: "v1" },
		chain: { type: "string", pattern: `^${UC.chain}$` },
		namespace: { type: "string", pattern: `^${UC.namespace}$` },
		reference: {
			type: "string",
			minLength: 1,
			description:
				"RAW (decoded) value; will be encodeURIComponent()'d when stringified.",
		},
		selector: {
			type: "string",
			minLength: 1,
			description:
				"RAW (decoded) sub-id; will be encodeURIComponent()'d when stringified.",
		},
	},
	required: ["version", "chain", "namespace", "reference"],
	examples: [
		{
			version: "v1",
			chain: "eth",
			namespace: "erc20",
			reference: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		},
		{
			version: "v1",
			chain: "near",
			namespace: "near-nft",
			reference: "apes.coolnft.near",
			selector: "series.1:blue/42",
		},
		{
			version: "v1",
			chain: "fiat",
			namespace: "iso4217",
			reference: "EUR",
		},
	],
};

// ---- Write files ----
function writeJSON(path: string, data: unknown) {
	mkdirSync(dirname(path), { recursive: true });
	// biome-ignore lint/style/useTemplate: <explanation>
	writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

writeJSON("./schemas/1cs_v1-string.schema.json", stringSchema);
writeJSON("./schemas/1cs_v1-object.schema.json", objectSchema);

// biome-ignore lint/suspicious/noConsole: <explanation>
console.log("✅ Wrote schemas to ./schemas");
// biome-ignore lint/suspicious/noConsole: <explanation>
console.log("↳ STRING pattern:\n", STRING_PATTERN);

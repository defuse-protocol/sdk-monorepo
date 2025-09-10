import Ajv from "ajv/dist/2020";
import { describe, expect, it } from "vitest";

import objectSchema from "../schemas/1cs_v1-object.schema.json" with {
	type: "json",
};
import stringSchema from "../schemas/1cs_v1-string.schema.json" with {
	type: "json",
};

describe("1cs_v1 JSON Schemas (Ajv 2020-12)", () => {
	const ajv = new Ajv({ allErrors: true, strict: false });

	const validateString = ajv.compile(stringSchema);
	const validateObject = ajv.compile(objectSchema);

	// ✅ Pull from schema examples
	const validStrings = stringSchema.examples.concat([
		// chain with hyphen
		"1cs_v1:eth-sepolia:erc20:0x0000000000000000000000000000000000000000",
		// selector with encoded reserved chars (:) and (/)
		"1cs_v1:near:near-nft:apes.coolnft.near:series%3A1%2Fblue%3A42",
		// reference with encoded space and plus
		"1cs_v1:aptos:aptos-coin:0x1%3A%3Amy%20coin%2Bv2",
		// uriComponent allows these unreserved chars without encoding
		"1cs_v1:fiat:iso4217:USD",
		// unicode via percent-encoding (✓)
		"1cs_v1:near:near-ft:%E2%9C%93-token.near",
		// parentheses, tilde, asterisk, apostrophe are allowed unencoded by encodeURIComponent
		"1cs_v1:sui:sui-coin:pkg(1)!~*'()",
	]);
	const validObjects = objectSchema.examples;

	// ❌ Custom invalids for failure tests
	const invalidStrings = [
		"xasset:v1:eth:erc20:0xA0b8", // wrong prefix
		"1cs_v1:eth::0xA0b8", // missing namespace
		"1cs_v1:eth:erc20:", // empty reference
		"1cs_v1:near:near-nft:apes.near:series.1:blue/42", // unencoded ':' and '/'
		"1cs_v1:aptos:aptos-coin:0x1%ZZ%20bad", // malformed percent escape
		"1cs_v1:Eth:erc20:0xabc", // uppercase in chain
		"1cs_v1:eth:1rc20:0xabc", // namespace must start with letter
		"1cs_v1:eth:erc20:0xabc:42:extra", // too many segments
		"1cs_v1:eth:erc721:0xabc:", // empty selector after colon
		"1cs_v1:sol:spl:EPjF/Bad", // raw slash not allowed (must be %2F)
		"1cs_v1:-bad:erc20:0xabc", // chain cannot start with hyphen
	];

	const invalidObjects = [
		{ version: "v1", chain: "ETH", namespace: "erc20", reference: "0xabc" }, // bad chain
		{ version: "v1", chain: "eth", namespace: "1rc20", reference: "0xabc" }, // bad namespace
		{ version: "v1", chain: "eth", namespace: "erc20", reference: "" }, // empty ref
		{
			version: "v1",
			chain: "near",
			namespace: "near-nft",
			reference: "apes.near",
			selector: "", // empty selector forbidden if present
		},
	];

	it.each(validStrings)("validates string IDs from schema examples", (s) => {
		expect(validateString(s)).toBe(true);
	});

	it.each(invalidStrings)("rejects invalid string IDs", (s) => {
		expect(validateString(s)).toBe(false);
	});

	it.each(validObjects)("validates object examples from schema", (o) => {
		expect(validateObject(o)).toBe(true);
	});

	it.each(invalidObjects)("rejects invalid objects", (o) => {
		expect(validateObject(o)).toBe(false);
	});
});

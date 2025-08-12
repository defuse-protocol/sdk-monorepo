import { describe, expect, it } from "vitest";
import stringSchema from "../schemas/1cs_v1-string.schema.json" with {
	type: "json",
};
import { parse1cs } from "./parse";
import { stringify1cs } from "./stringify";

describe("stringify()", () => {
	it("round-trips string → object → string for all valid strings", () => {
		const all = stringSchema.examples.concat([
			// chain with hyphen
			"1cs_v1:eth-sepolia:erc20:0x0000000000000000000000000000000000000000",
			// selector with encoded reserved chars (:) and (/)
			"1cs_v1:near:near-nft:apes.coolnft.near:series%3A1%2Fblue%3A42",
			// reference with encoded space and plus
			"1cs_v1:aptos:aptos-coin:0x1%3A%3Amy%20coin%2Bv2",
			// uriComponent allows these unreserved chars without encoding
			"1cs_v1:fiat:iso4217:USD",
			// unicode via percent-encoding
			"1cs_v1:near:near-ft:%E2%9C%93-token.near",
			// parentheses, tilde, asterisk, apostrophe are allowed unencoded by encodeURIComponent
			"1cs_v1:sui:sui-coin:pkg(1)!~*'()",
		]);
		for (const s of all) {
			expect(stringify1cs(parse1cs(s))).toEqual(s);
		}
	});
});

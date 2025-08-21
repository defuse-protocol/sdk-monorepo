import { describe, expect, it } from "vitest";
import objectSchema from "../schemas/1cs_v1-object.schema.json" with {
	type: "json",
};
import { parse1cs } from "./parse";
import { stringify1cs } from "./stringify";
import type { OneCsAsset } from "./types";

describe("parse()", () => {
	it("round-trips object → string → object for all valid objects", () => {
		const all = objectSchema.examples;
		for (const o of all) {
			expect(parse1cs(stringify1cs(o as OneCsAsset))).toEqual(o);
		}
	});
});

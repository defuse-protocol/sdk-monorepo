import { describe, expect, it } from "vitest";
import isHex from "./hex";

describe("isHex()", () => {
	it.each([
		"9b946b769a71dfacf62daa68e3d94f60b9df3ffd1b9ec4ac9258b56e890022ae", //BNB
		"eb77be889cb6dd8112af0f750959b19da0899460e154e5ae7d01000cce23e371", // POLYGON
		"6cb1992e56cb0941bcd4d1ecf557d32ff1f4c4ac89e92e4b6849f812f61512d4", // TON
		"b45ff715159772bd5ce04fa124657782a95e799bfcb62882ba2d95bd946300d2", // OPTIMISM
		"6286537ea071852d259a9db1b58f86edb49ec18ccab24f8263a4c525d653cff5", // AVALANCHE
		"8d4f5c6b6d7337f7cf730ea04386f29ec064ded83c5d939d64758cc94a2eb0d6", // STELLAR
	])("return true for valid non 0x prefixed strings", async (value) => {
		expect(isHex(value)).toBe(true);
	});

	it.each(["Withdrawal already processed", "Random string", "0x123"])(
		"block any other string and 0x prefix strings",
		async (value) => {
			expect(isHex(value)).toBe(false);
		},
	);
});

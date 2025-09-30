import { describe, expect, it } from "vitest";
import { validateOmniToken } from "./omni-bridge-utils";

describe("validateOmniToken()", () => {
	it("valid omni bridge token ids", () => {
		for (const assetId of [
			"eth.bridge.near",
			"sol.omdep.near",
			"base.omdep.near",
			"arb.omdep.near",
			"foo.omdep.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
			"sol-ABC123.omdep.near",
			"arb-ABC123.omdep.near",
			"base-ABC123.omdep.near",
		]) {
			expect(validateOmniToken(assetId)).toBe(true);
		}
	});

	it("invalid omni bridge token ids", () => {
		for (const assetId of [
			"eth.Hellobridge.near",
			"sol-ABC123.test.hello.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridgeomni.near",
			"btc.omft.near",
			"v3_1.omni.hot.tg:56_11111111111111111111",
			"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", // USDC
		]) {
			expect(validateOmniToken(assetId)).toBe(false);
		}
	});
});

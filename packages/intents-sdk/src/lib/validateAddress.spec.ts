import { describe, expect, it } from "vitest";
import { validateAddress } from "./validateAddress";
import { BlockchainEnum } from "@defuse-protocol/internal-utils/src";

describe("validateZcashAddress", () => {
	const validTransparentAddress = "t1Q879cLgqaCd7zKRi79wQYuGBenmNX6cKn";
	const validUAAddress =
		"u1rgqfsvuxkwv7vc54nxd4g733xwh686ur06usz8vucns3ywx350fmeaz5w7a7mxg5u6gp28pufwlmsenxzqhphcl9nt56u5428c836u7wyecxs7alnms08txxr3g4gj850eclnhsfcw2cfll92r3xfd7ydhhpslymygl9qxz4wudrtlfh";
	const invalidTransparentAddress = "t1r2VHBwC5eAnZB22YNFSJg8iFtWgoAEKW000";
	const invalidUA = "u1r2VHBwC5eAnZB22YNFSJg8iFtWgoAEKW000";

	it("accepts a valid transparent address", () => {
		expect(validateAddress(validTransparentAddress, BlockchainEnum.zec)).toBe(
			true,
		);
	});

	it("accepts a valid UA address", () => {
		expect(validateAddress(validUAAddress, BlockchainEnum.zec)).toBe(true);
	});

	it("rejects a transparent address with invalid characters", () => {
		expect(validateAddress(invalidTransparentAddress, BlockchainEnum.zec)).toBe(
			false,
		);
	});

	it("rejects a ua address with invalid characters", () => {
		expect(validateAddress(invalidUA, BlockchainEnum.zec)).toBe(false);
	});
});

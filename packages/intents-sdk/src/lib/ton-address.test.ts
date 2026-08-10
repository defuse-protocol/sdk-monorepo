import { describe, expect, it } from "vitest";
import { Address } from "@ton/core";
import { parseTonAddress } from "../intents/intent-hashes/ton-connect";
import { parseTonUserFriendlyAddress } from "./ton-address";

// Run every input through both our parser and @ton/core's. Assert they
// produce the same (workchain, 32-byte hash). That pair is everything that
// enters the TON Connect message hash, so if these agree, downstream code
// using either parser will too.
//
// Inputs come from @ton/core's Address.spec.ts plus standard-base64 variants,
// masterchain, and our intent's UQ-form.

const SHARED_RAW =
	"0:2cf55953e92efbeadab7ba725c3f93a0b23f842cbba72d7b8e6f510a70e422e3";

// All inputs below are the same address (workchain 0, hash 2cf55953...) in
// different forms.
const SHARED_INPUTS: readonly string[] = [
	// Raw form
	SHARED_RAW,
	// Raw form, uppercase hex
	"0:2CF55953E92EFBEADAB7BA725C3F93A0B23F842CBBA72D7B8E6F510A70E422E3",

	// URL-safe base64 (what most wallets emit)
	"EQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4wJB", // mainnet bounceable
	"UQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi41-E", // mainnet non-bounceable
	"kQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi47nL", // testnet bounceable
	"0QAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4-QO", // testnet non-bounceable

	// Standard base64 (same address, +/_ swapped for -/_)
	"EQAs9VlT6S776tq3unJcP5Ogsj+ELLunLXuOb1EKcOQi4wJB",
	"UQAs9VlT6S776tq3unJcP5Ogsj+ELLunLXuOb1EKcOQi41+E",
	"kQAs9VlT6S776tq3unJcP5Ogsj+ELLunLXuOb1EKcOQi47nL",
	"0QAs9VlT6S776tq3unJcP5Ogsj+ELLunLXuOb1EKcOQi4+QO",
];

describe("parseTonAddress vs @ton/core cross-validation", () => {
	it.each(SHARED_INPUTS)(
		"agrees with @ton/core on workchain + hash for %s",
		(input) => {
			const ours = parseTonAddress(input);
			const theirs = Address.parse(input);

			expect(ours.workchainId).toBe(theirs.workChain);
			expect(Array.from(ours.address)).toEqual(Array.from(theirs.hash));
		},
	);

	it("agrees on masterchain (-1) raw addresses", () => {
		const input =
			"-1:3333333333333333333333333333333333333333333333333333333333333333";
		const ours = parseTonAddress(input);
		const theirs = Address.parse(input);

		expect(ours.workchainId).toBe(-1);
		expect(theirs.workChain).toBe(-1);
		expect(Array.from(ours.address)).toEqual(Array.from(theirs.hash));
	});

	it("agrees on the intent payload address (UQBkxBWE…)", () => {
		const input = "UQBkxBWE4Gf9gd2sNbm1SJ6zXWnbA6ywoBvpAUQhBXJY_YiM";
		const ours = parseTonAddress(input);
		const theirs = Address.parse(input);

		expect(ours.workchainId).toBe(theirs.workChain);
		expect(Array.from(ours.address)).toEqual(Array.from(theirs.hash));
	});

	it("all SHARED_INPUTS decode to the same 32-byte hash", () => {
		// Catches mistakes in the fixture itself (e.g. a typo would make this
		// fail before any cross-validation test runs).
		const expectedHash = Address.parse(SHARED_RAW).hash;
		for (const input of SHARED_INPUTS) {
			const ours = parseTonAddress(input);
			expect(Array.from(ours.address)).toEqual(Array.from(expectedHash));
		}
	});
});

describe("parseTonUserFriendlyAddress (low-level)", () => {
	it("exposes the tag byte for caller-side network/bounceability checks", () => {
		const mainnetBounceable = parseTonUserFriendlyAddress(
			"EQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4wJB",
		);
		const mainnetNonBounceable = parseTonUserFriendlyAddress(
			"UQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi41-E",
		);
		const testnetBounceable = parseTonUserFriendlyAddress(
			"kQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi47nL",
		);
		const testnetNonBounceable = parseTonUserFriendlyAddress(
			"0QAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4-QO",
		);

		expect(mainnetBounceable?.tag).toBe(0x11);
		expect(mainnetNonBounceable?.tag).toBe(0x51);
		expect(testnetBounceable?.tag).toBe(0x91);
		expect(testnetNonBounceable?.tag).toBe(0xd1);
	});

	it("returns null on invalid CRC", () => {
		// Last char flipped from B to A, which changes the CRC bytes.
		expect(
			parseTonUserFriendlyAddress(
				"EQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4wJA",
			),
		).toBeNull();
	});

	it("returns null on wrong length", () => {
		expect(parseTonUserFriendlyAddress("EQ")).toBeNull();
		expect(parseTonUserFriendlyAddress("")).toBeNull();
	});

	it("returns null on non-base64 input", () => {
		expect(parseTonUserFriendlyAddress("not!an!address!")).toBeNull();
	});
});

import { base64urlnopad } from "@scure/base";
import { describe, expect, it } from "vitest";
import { Chains } from "./caip2";
import { compareAddresses } from "./compareAddresses";
import { TON_ADDRESS_TAG_BOUNCEABLE_MAINNET, crc16ccitt } from "./ton-address";

function buildTonFriendlyAddress(
	workchainId: number,
	addressHex: string,
): string {
	const data = new Uint8Array(36);
	data[0] = TON_ADDRESS_TAG_BOUNCEABLE_MAINNET;
	data[1] = workchainId & 0xff;
	for (let i = 0; i < 32; i++) {
		data[2 + i] = Number.parseInt(addressHex.slice(i * 2, i * 2 + 2), 16);
	}
	const [hi, lo] = crc16ccitt(data.subarray(0, 34));
	data[34] = hi;
	data[35] = lo;
	return base64urlnopad.encode(data);
}

describe("compareAddresses", () => {
	it("compares EVM addresses case-insensitively", () => {
		const lower = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
		const upper = "0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD";
		expect(compareAddresses(lower, upper, Chains.Ethereum)).toBe(true);
	});

	it("rejects invalid EVM addresses", () => {
		expect(compareAddresses("not-an-address", "0x0", Chains.Ethereum)).toBe(
			false,
		);
	});

	it.each([Chains.Aptos, Chains.Movement, Chains.Sui, Chains.Starknet])(
		"compares %s addresses ignoring case and leading zeros",
		(chain) => {
			const short = "0xAB";
			const padded = `0x${"0".repeat(60)}00ab`;
			expect(compareAddresses(short, padded, chain)).toBe(true);
			expect(compareAddresses(short, "0xac", chain)).toBe(false);
		},
	);

	it("compares TON raw and friendly forms of the same address as equal", () => {
		const addressHex = "1".repeat(64);
		const raw = `0:${addressHex}`;
		const friendly = buildTonFriendlyAddress(0, addressHex);
		expect(compareAddresses(raw, friendly, Chains.TON)).toBe(true);
	});

	it("rejects TON addresses on different workchains", () => {
		const addressHex = "1".repeat(64);
		expect(
			compareAddresses(`0:${addressHex}`, `-1:${addressHex}`, Chains.TON),
		).toBe(false);
	});

	it("compares Tron base58 and hex forms of the same address as equal", () => {
		const base58Address = "TA4Y62o6YC2Zsck9rZVGTvqW1AQ7X9zTnj";
		const hexAddress = "410102030405060708090a0b0c0d0e0f1011121314";
		expect(compareAddresses(base58Address, hexAddress, Chains.Tron)).toBe(true);
	});

	it("rejects malformed Tron addresses", () => {
		expect(
			compareAddresses(
				"not-tron",
				"410102030405060708090a0b0c0d0e0f1011121314",
				Chains.Tron,
			),
		).toBe(false);
	});

	it("compares Stellar addresses ignoring case", () => {
		const upper = `G${"A".repeat(55)}`;
		const lower = upper.toLowerCase();
		expect(compareAddresses(upper, lower, Chains.Stellar)).toBe(true);
	});

	it("treats Solana addresses as case-sensitive", () => {
		const a = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";
		const b = a.toLowerCase();
		expect(compareAddresses(a, b, Chains.Solana)).toBe(false);
		expect(compareAddresses(a, a, Chains.Solana)).toBe(true);
	});
});

import { base64urlnopad, bech32m } from "@scure/base";
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

describe("compareAddresses Miden", () => {
	const accountId = bech32m.encodeFromBytes(
		"mm",
		bech32m.decodeToBytes("mtst1aqu036cju6kddyfsvhpk3had7y7ck8sy").bytes,
	);

	it("treats routing suffix and case as irrelevant", () => {
		expect(
			compareAddresses(
				accountId,
				`${accountId.toUpperCase()}_qruqqypuyph`,
				Chains.Miden,
			),
		).toBe(true);
	});

	it("matches hex account id against its bech32 address", () => {
		expect(
			compareAddresses(
				accountId,
				"0x38f8eb12e6acd6913065c368dfadf1",
				Chains.Miden,
			),
		).toBe(true);
		expect(
			compareAddresses(
				"0x38f8eb12e6acd6913065c368dfadf1",
				accountId,
				Chains.Miden,
			),
		).toBe(true);
	});

	it("returns false for different accounts or malformed input", () => {
		const other = bech32m.decodeToBytes(accountId).bytes;
		other[1] = (other[1] ?? 0) ^ 0xff;

		expect(
			compareAddresses(
				accountId,
				bech32m.encodeFromBytes("mm", other),
				Chains.Miden,
			),
		).toBe(false);
		expect(compareAddresses(accountId, "garbage", Chains.Miden)).toBe(false);
	});

	describe("token accounts", () => {
		const tokens = [
			[
				"BTC",
				"0x3084d3c389ececd15fda9770d18c8a",
				"mm1aqcgf57r38kwe52lm2thp5vv3g4af6h4",
			],
			[
				"pyUSD",
				"0xeb4266c94493b091380b25349fddd3",
				"mm1ar45yekfgjfmpyfcpvjnf87a6vnu3arq",
			],
			[
				"USDT",
				"0x5cb79d29507d3ad17bb6dc60279e89",
				"mm1apwt08ff2p7n45tmkmwxqfu73y70hydp",
			],
			[
				"SOL",
				"0xf4f3dd3678997811522164320be4be",
				"mm1ar608hfk0zvhsy2jy9jryzlyhcdy7fv7",
			],
			[
				"USDCx",
				"0xe69e6ca6e39df1b10c1e5399399feb",
				"mm1arnfum9xuwwlrvgvrefejwvlavn3vk24",
			],
			[
				"ETH",
				"0x419f8f4bff72959132aa7cea15a4c1",
				"mm1apqelr6tlaeftyfj4f7w59dycysmtawe",
			],
		] as const;

		it.each(tokens)("%s: hex equals its bech32 address", (_, hexId, bech32) => {
			expect(compareAddresses(hexId, bech32, Chains.Miden)).toBe(true);
			expect(compareAddresses(bech32, hexId, Chains.Miden)).toBe(true);
			expect(
				compareAddresses(
					hexId.toUpperCase().replace("0X", "0x"),
					bech32,
					Chains.Miden,
				),
			).toBe(true);
		});

		it("different tokens never match, in any format", () => {
			for (const [i, [, hexA, bech32A]] of tokens.entries()) {
				for (const [j, [, hexB, bech32B]] of tokens.entries()) {
					if (i === j) continue;
					expect(compareAddresses(hexA, hexB, Chains.Miden)).toBe(false);
					expect(compareAddresses(hexA, bech32B, Chains.Miden)).toBe(false);
					expect(compareAddresses(bech32A, bech32B, Chains.Miden)).toBe(false);
				}
			}
		});
	});
});

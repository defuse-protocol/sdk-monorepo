import { describe, expect, it } from "vitest";
import {
	validateAddress,
	validateLitecoinAddress,
	validateBchAddress,
	validateCardanoAddress,
} from "./validateAddress";
import { Chains } from "./caip2";

describe("validateBtcAddress", () => {
	it("accepts valid addresses", () => {
		const valid = [
			// P2PKH (1...)
			"18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			"1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
			// P2SH (3...)
			"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
			// Bech32 SegWit v0 (bc1q...)
			"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
			"bc1q34aq5drpuwy3wgl9lhup9892qp6svr8ldzyy7c",
			// Bech32m Taproot (bc1p...)
			"bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297",
		];

		for (const address of valid) {
			expect(validateAddress(address, Chains.Bitcoin)).toBe(true);
		}
	});

	it("rejects invalid addresses", () => {
		const invalid = [
			// Extra characters at start (not base58)
			"018HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			// Invalid characters (0, O, I, l are not in base58)
			"1BvBMSEYstWetqTFn5Au4m4GFg7xJaNON2",
			// Invalid first character
			"28HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			// Too short
			"1BvBMSEYstWetqTFn5Au",
			// Invalid bech32 prefix
			"tc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		];

		for (const address of invalid) {
			expect(validateAddress(address, Chains.Bitcoin)).toBe(false);
		}
	});
});

describe("validateEthAddress", () => {
	it("accepts valid checksummed addresses", () => {
		expect(
			validateAddress(
				"0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
				Chains.Ethereum,
			),
		).toBe(true);
	});

	it("accepts lowercase addresses (valid format)", () => {
		expect(
			validateAddress(
				"0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
				Chains.Ethereum,
			),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("0x123", Chains.Ethereum)).toBe(false);
		expect(validateAddress("not-an-address", Chains.Ethereum)).toBe(false);
		// Invalid checksum (mixed case but wrong)
		expect(
			validateAddress(
				"0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD",
				Chains.Ethereum,
			),
		).toBe(false);
	});
});

describe("validateAleoAddress", () => {
	it("accepts valid checksummed addresses", () => {
		expect(
			validateAddress(
				"aleo1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0j",
				Chains.Aleo,
			),
		).toBe(true);
	});

	it("rejects addresses with wrong prefix", () => {
		// Wrong prefix (not 'aleo')
		expect(
			validateAddress(
				"near1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0j",
				Chains.Aleo,
			),
		).toBe(false);
	});

	it("rejects addresses with invalid bech32m checksum", () => {
		// Invalid checksum (changed last character from 'j' to 'k')
		expect(
			validateAddress(
				"aleo1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0k",
				Chains.Aleo,
			),
		).toBe(false);
	});

	it("rejects addresses that are too short", () => {
		expect(validateAddress("aleo1dg722m22fzpz6", Chains.Aleo)).toBe(false);
	});

	it("rejects addresses with extra characters", () => {
		expect(
			validateAddress(
				"xaleo1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0j",
				Chains.Aleo,
			),
		).toBe(false);
		expect(
			validateAddress(
				"aleo1dg722m22fzpz6xjdrvl9tzu5t68zmypj5p74khlqcac0gvednygqxaax0jx",
				Chains.Aleo,
			),
		).toBe(false);
	});

	it("rejects completely invalid strings", () => {
		expect(validateAddress("not-an-aleo-address", Chains.Aleo)).toBe(false);
		expect(validateAddress("aleo1", Chains.Aleo)).toBe(false);
	});
});

describe("validateSolAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
				Chains.Solana,
			),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("invalid-solana-address", Chains.Solana)).toBe(
			false,
		);
	});
});

describe("validateDogeAddress", () => {
	it("accepts valid addresses", () => {
		const valid = [
			"D86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPP",
			"A86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPP",
		];

		for (const address of valid) {
			expect(validateAddress(address, Chains.Dogecoin)).toBe(true);
		}
	});

	it("rejects addresses with extra characters", () => {
		expect(
			validateAddress("xD86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPP", Chains.Dogecoin),
		).toBe(false);
		expect(
			validateAddress("D86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPPx", Chains.Dogecoin),
		).toBe(false);
	});
});

describe("validateXrpAddress", () => {
	it("accepts valid classic addresses", () => {
		expect(
			validateAddress("rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv", Chains.XRPL),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("invalid-xrp-address", Chains.XRPL)).toBe(false);
	});
});

describe("validateTronAddress", () => {
	it("accepts valid base58 addresses", () => {
		expect(
			validateAddress("TGNZdiQV31H3JvTtC1yH6yuipnqs6LN2Jv", Chains.Tron),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("invalid-tron-address", Chains.Tron)).toBe(false);
	});
});

describe("validateTonAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"EQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bL",
				Chains.TON,
			),
		).toBe(true);
		expect(
			validateAddress(
				"UQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bL",
				Chains.TON,
			),
		).toBe(true);
	});

	it("rejects addresses with extra characters", () => {
		expect(
			validateAddress(
				"xEQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bL",
				Chains.TON,
			),
		).toBe(false);
		expect(
			validateAddress(
				"EQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bLx",
				Chains.TON,
			),
		).toBe(false);
	});
});

describe("validateSuiAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"0x3a5e9d40e8bb62a7f6f8b6d934a1e42a7a2f5cc1cb122c1b9a8d2f6cb09a8712",
				Chains.Sui,
			),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("0x123", Chains.Sui)).toBe(false);
	});
});

describe("validateStellarAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"GAXQC6TWRKQ4TK7OVADU2DQMXHFYUDHGO6JIIIHLDD7RTBHYHXPSNUTV",
				Chains.Stellar,
			),
		).toBe(true);
	});

	it("rejects addresses with extra characters", () => {
		expect(
			validateAddress(
				"xGAXQC6TWRKQ4TK7OVADU2DQMXHFYUDHGO6JIIIHLDD7RTBHYHXPSNUTV",
				Chains.Stellar,
			),
		).toBe(false);
		expect(
			validateAddress(
				"GAXQC6TWRKQ4TK7OVADU2DQMXHFYUDHGO6JIIIHLDD7RTBHYHXPSNUTVx",
				Chains.Stellar,
			),
		).toBe(false);
	});
});

describe("validateAptosAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"0xbc3557a52bcac15d470e6ffa421eeea105baffd8471d6aa2c0238380f363ccd3",
				Chains.Aptos,
			),
		).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("0x123", Chains.Aptos)).toBe(false);
		expect(
			validateAddress(
				"bc3557a52bcac15d470e6ffa421eeea105baffd8471d6aa2c0238380f363ccd3",
				Chains.Aptos,
			),
		).toBe(false);
	});
});

describe("validateCardanoAddress", () => {
	it("accepts valid mainnet addresses", () => {
		expect(
			validateCardanoAddress(
				"addr1qxg5fnc2dfssnhzygvkqzzy2fcqcph533ek58jngqksaqjwwk2uhs32lj8zh62fq5zdeawrshdfp23t5vcm538glyn6sqngmem",
			),
		).toBe(true);
	});

	it("rejects testnet addresses", () => {
		// testnet prefix is addr_test, not addr
		expect(
			validateCardanoAddress(
				"addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
			),
		).toBe(false);
	});
});

describe("validateStarknetAddress", () => {
	it("accepts valid addresses", () => {
		expect(
			validateAddress(
				"0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
				Chains.Starknet,
			),
		).toBe(true);
		// Short addresses are valid (leading zeros omitted)
		expect(validateAddress("0x1", Chains.Starknet)).toBe(true);
	});

	it("rejects invalid addresses", () => {
		expect(validateAddress("not-an-address", Chains.Starknet)).toBe(false);
		// Too long (65 hex chars after 0x)
		expect(
			validateAddress(
				"0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7a",
				Chains.Starknet,
			),
		).toBe(false);
	});
});

describe("validateZcashAddress", () => {
	const validTransparentAddress = "t1Q879cLgqaCd7zKRi79wQYuGBenmNX6cKn";
	const validUAAddress =
		"u1rgqfsvuxkwv7vc54nxd4g733xwh686ur06usz8vucns3ywx350fmeaz5w7a7mxg5u6gp28pufwlmsenxzqhphcl9nt56u5428c836u7wyecxs7alnms08txxr3g4gj850eclnhsfcw2cfll92r3xfd7ydhhpslymygl9qxz4wudrtlfh";
	const invalidTransparentAddress = "t1r2VHBwC5eAnZB22YNFSJg8iFtWgoAEKW000";
	const invalidUA = "u1r2VHBwC5eAnZB22YNFSJg8iFtWgoAEKW000";

	it("accepts a valid transparent address", () => {
		expect(validateAddress(validTransparentAddress, Chains.Zcash)).toBe(true);
	});

	it("accepts a valid UA address", () => {
		expect(validateAddress(validUAAddress, Chains.Zcash)).toBe(true);
	});

	it("rejects a transparent address with invalid characters", () => {
		expect(validateAddress(invalidTransparentAddress, Chains.Zcash)).toBe(
			false,
		);
	});

	it("rejects a ua address with invalid characters", () => {
		expect(validateAddress(invalidUA, Chains.Zcash)).toBe(false);
	});
});

describe("validateLitecoinAddress()", () => {
	it("accepts a valid address", () => {
		const list = [
			// P2PKH (L..., ver 0x30)
			"LUbHk3E8DHKuK93GxCEDebdekFhnNeA2f3",
			"LMxq3bAp4GnvtNGkRAk4WDXxzmo4XYJBJE",
			"LKg2WbxN9zfbbNA5QhC2cy8srRtDhib5fi",
			// P2SH (M..., ver 0x32)
			"MJ2K9cQSJC16gzDFxd7y1MKVGzqfRqeRbK",
			"MUuUxKakzP9Rp9rqUVNPXev2zVarzobvPs",
			"MWnym2ixwoqPEWvihrCUT8HHPZbmfK6fbM",
			// P2SH legacy (3..., ver 0x05)
			"3GoitrULXWigQqj4fV6FMVqtz8mru5auYh",
			"3LraWBGhsShDCuhiR7i6S5mbbw3GMe56Y4",
			"3F7DULAQbem9nPL8w6wmHoa7CA5annzy4a",
			// SegWit v0 P2WPKH (ltc1q..., Bech32)
			"ltc1q238uqdd9fpzqyp6erun8gfj7q8a8dq9h97nkc3",
			// SegWit v0 P2WSH (ltc1q..., Bech32)
			"ltc1q3s2ujuag0k7k6cy6kflapq6acsuug4t8k3pq5dzps7c9p7uq5t7ss8xhgy",
			// Taproot v1 (ltc1p..., Bech32m)
			"ltc1pjjlh0qyqyeyel5qxny8rw76w8exsx6g7yndj2gnsgu4w3f385rhqyt98uk",
		];

		for (const address of list) {
			expect(validateLitecoinAddress(address)).toBe(true);
		}
	});

	it("rejects invalid", () => {
		const list = [
			// Base58: bad checksum
			"LUbHk3E8DHKuK93GxCEDebdekFhnNeA2f1",
			"MJ2K9cQSJC16gzDFxd7y1MKVGzqfRqeRb1",
			"3GoitrULXWigQqj4fV6FMVqtz8mru5auY1",
			// Base58: wrong prefix for LTC
			"1LbHk3E8DHKuK93GxCEDebdekFhnNeA2f3",
			"2Mxq3bAp4GnvtNGkRAk4WDXxzmo4XYJBJE",
			// Bech32: bad checksum
			"ltc1q238uqdd9fpzqyp6erun8gfj7q8a8dq9h97nkcq",
			// Bech32: wrong HRP
			"bc1q238uqdd9fpzqyp6erun8gfj7q8a8dq9h97nkc3",
			// Bech32: mixed case
			"ltc1q238uqdd9fpzqyp6erun8gfj7q8a8dq9h97nKC3",
		];

		for (const address of list) {
			expect(validateLitecoinAddress(address)).toBe(false);
		}
	});
});

describe("validateBchAddress()", () => {
	it("accepts valid addresses", () => {
		const list = [
			// Legacy P2PKH (1...)
			"1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu",
			"1KXrWXciRDZUpQwQmuM1DbwsKDLYAYsVLR",
			// Legacy P2SH (3...)
			"3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC",
			"3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
			// CashAddr P2PKH (q...) - 160-bit hash, 42 chars
			"qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
			"bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
			"qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy",
			// CashAddr P2SH (p...) - 160-bit hash, 42 chars
			"pp8skudq3x5hzw8ew7vzsw8tn4k8wxsqsv0lt0mf3g",
			"bitcoincash:pp8skudq3x5hzw8ew7vzsw8tn4k8wxsqsv0lt0mf3g",
			// CashAddr 256-bit hash (61 chars) - from official spec test vectors
			"qvch8mmxy0rtfrlarg7ucrxxfzds5pamg73h7370aa87d80gyhqxq5nlegake",
			"bitcoincash:qvch8mmxy0rtfrlarg7ucrxxfzds5pamg73h7370aa87d80gyhqxq5nlegake",
		];

		for (const address of list) {
			expect(validateBchAddress(address)).toBe(true);
		}
	});

	it("rejects invalid addresses", () => {
		const list = [
			// Invalid checksum
			"qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6b",
			// Wrong prefix
			"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
			// Invalid characters
			"qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx1a",
			// Wrong length (too short)
			"qpm2qsznhks23z7629mms6s4cwef74vcw",
			// Wrong length (62 chars - invalid, should be 42 or 61)
			"qvch8mmxy0rtfrlarg7ucrxxfzds5pamg73h7370aa87d80gyhqxq5nlegakex",
			// Invalid legacy address
			"1BpEi6DfDAUFd7GtittLSdBeYJvcoaVgg0",
		];

		for (const address of list) {
			expect(validateBchAddress(address)).toBe(false);
		}
	});
});

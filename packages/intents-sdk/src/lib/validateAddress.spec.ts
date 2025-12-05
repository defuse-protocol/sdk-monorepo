import { describe, expect, it } from "vitest";
import {
	validateAddress,
	validateLitecoinAddress,
	validateBchAddress,
} from "./validateAddress";
import { Chains } from "./caip2";

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

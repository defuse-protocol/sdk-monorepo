import { describe, expect, it } from "vitest";
import {
	getBridgedToken,
	getAccountOmniStorageBalance,
	getTokenDecimals,
	validateOmniToken,
	omniAddress,
	getChain,
	getMinimumTransferableAmount,
	verifyTransferAmount,
	normalizeAmount,
	calculateStorageAccountId,
} from "./omni-bridge-utils";
import {
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { ChainKind, type OmniAddress } from "./omni-bridge-types";

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

describe("getAccountOmniStorageBalance()", () => {
	it("fetches omni storage balance and parses it successfully", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});
		await expect(
			getAccountOmniStorageBalance(nearProvider, "intents.near"),
		).resolves.toEqual({
			total: expect.any(String),
			available: expect.any(String),
		});
	});
});
describe("getBridgedToken()", () => {
	it("resolves a token from NEAR to SOL directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});
		const nearAddress = "near:token.publicailab.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Sol,
		);
		await expect(result).toBe(
			"sol:AXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
		);
	});
	it("resolves a token from NEAR to ETH directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		// Aurora
		const nearAddress =
			"near:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Eth,
		);
		await expect(result).toBe("eth:0xaaaaaa20d9e0e2461697782ef11675f668207961");
	});
	it("resolves a token from NEAR to BASE directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		const nearAddress = "near:wrap.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Base,
		);
		await expect(result).toBe(
			"base:0x02eea354d135d1a912967c2d2a6147deb01ef92e",
		);
	});
	it("resolves a token from NEAR to ARB directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		// Aurora
		const nearAddress = "near:wrap.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Arb,
		);
		await expect(result).toBe("arb:0x02eea354d135d1a912967c2d2a6147deb01ef92e");
	});

	it("returns null for unregistered tokens", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		const invalidAddress = "near:unregistered";
		const result = await getBridgedToken(
			nearProvider,
			invalidAddress,
			ChainKind.Eth,
		);
		expect(result).toBeNull();
	});
});
describe("getTokenDecimals()", () => {
	it("resolves tokens decimals from NEAR to SOL directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(
				nearProvider,
				omniAddress(
					ChainKind.Sol,
					"AXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
				),
			),
		).resolves.toEqual({
			decimals: expect.any(Number),
			origin_decimals: expect.any(Number),
		});
	});
	it("returns null for non existing token", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(
				nearProvider,
				omniAddress(
					ChainKind.Sol,
					"XXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
				),
			),
		).resolves.toBeNull();
	});
});

describe("getChain", () => {
	it("should extract chain from omni address", () => {
		const addr: OmniAddress = "eth:0x123";
		expect(getChain(addr)).toBe(ChainKind.Eth);
	});

	it("should work with all chain types", () => {
		const addresses: OmniAddress[] = [
			"eth:0x123",
			"near:alice.near",
			"sol:solana123",
			"arb:0xarb456",
			"base:0xbase789",
			"bnb:0xbnb123",
		];

		const expected = [
			ChainKind.Eth,
			ChainKind.Near,
			ChainKind.Sol,
			ChainKind.Arb,
			ChainKind.Base,
			ChainKind.Bnb,
		];

		addresses.forEach((addr, i) => {
			expect(getChain(addr)).toBe(expected[i]);
		});
	});
});

describe("getMinimumTransferableAmount", () => {
	it("calculates minimum for NEAR to Solana", () => {
		const minAmount = getMinimumTransferableAmount(24, 9);
		// 1 SOL unit worth of NEAR (scaled up to 24 decimals)
		expect(minAmount).toBe(1000000000000000n);
	});

	it("handles equal decimals", () => {
		const minAmount = getMinimumTransferableAmount(6, 6);
		expect(minAmount).toBe(1n);
	});
});

describe("verifyTransferAmount", () => {
	it("approves valid NEAR to Solana transfer", () => {
		const amount = 2000000000000000000000000n; // 2.0 NEAR
		const fee = 1000000000000000000000000n; // 1.0 NEAR fee
		expect(verifyTransferAmount(amount, fee, 24, 9)).toBe(true);
	});

	it("rejects transfer that would normalize to zero", () => {
		const amount = 1n; // 1 yoctoNEAR
		const fee = 0n;
		expect(verifyTransferAmount(amount, fee, 24, 9)).toBe(false);
	});

	it("rejects transfer where fee equals amount", () => {
		const amount = 1000000000000000000000000n; // 1.0 NEAR
		const fee = 1000000000000000000000000n; // 1.0 NEAR
		expect(verifyTransferAmount(amount, fee, 24, 9)).toBe(false);
	});

	it("rejects near-equal amount and fee that would normalize to zero", () => {
		const amount = 1000000000000000000000000n; // 1.0 NEAR
		const fee = 999999999999999999999999n; // 0.999999999999999999999999 NEAR
		expect(verifyTransferAmount(amount, fee, 24, 9)).toBe(false);
	});

	it("handles edge case where normalization of difference is zero", () => {
		const amount = 100n;
		const fee = 1n;
		expect(verifyTransferAmount(amount, fee, 24, 9)).toBe(false);
	});

	it("handles transfers to higher precision", () => {
		const amount = 2000000000n; // 2.0 SOL
		const fee = 1000000000n; // 1.0 SOL fee
		expect(verifyTransferAmount(amount, fee, 9, 18)).toBe(true);
	});
});

describe("getMinimumTransferableAmount", () => {
	it("calculates minimum for NEAR to Solana", () => {
		const minAmount = getMinimumTransferableAmount(24, 9);
		// 1 SOL unit worth of NEAR (scaled up to 24 decimals)
		expect(minAmount).toBe(1000000000000000n);
	});

	it("handles equal decimals", () => {
		const minAmount = getMinimumTransferableAmount(6, 6);
		expect(minAmount).toBe(1n);
	});
});

describe("normalizeAmount", () => {
	it("handles equal decimals", () => {
		const amount = 1000000n; // 1.0 with 6 decimals
		expect(normalizeAmount(amount, 6, 6)).toBe(1000000n);
	});

	it("scales down from NEAR (24) to Solana (9)", () => {
		const amount = 1000000000000000000000000n; // 1.0 NEAR
		const expected = 1000000000n; // 1.0 in Solana decimals
		expect(normalizeAmount(amount, 24, 9)).toBe(expected);
	});

	it("scales down from ETH (18) to Solana (9)", () => {
		const amount = 1000000000000000000n; // 1.0 ETH
		const expected = 1000000000n; // 1.0 in Solana decimals
		expect(normalizeAmount(amount, 18, 9)).toBe(expected);
	});

	it("scales up from Solana (9) to NEAR (24)", () => {
		const amount = 1000000000n; // 1.0 in Solana
		const expected = 1000000000000000000000000n; // 1.0 in NEAR
		expect(normalizeAmount(amount, 9, 24)).toBe(expected);
	});

	it("handles edge case of 1 yoctoNEAR to Solana", () => {
		const amount = 1n; // 1 yoctoNEAR
		expect(normalizeAmount(amount, 24, 9)).toBe(0n);
	});

	it("maintains precision when possible", () => {
		// 0.000000000000000001 ETH (smallest unit)
		const amount = 1n;
		// Should maintain precision when going to 24 decimals
		const expected = 1000000n;
		expect(normalizeAmount(amount, 18, 24)).toBe(expected);
	});
});

describe("calculateStorageAccountId", () => {
	it("verify known storage account ID", () => {
		const transferMessage = {
			token: "near:token.publicailab.near" as const,
			amount: 1000000000n,
			recipient: "sol:3XfLNw6yhA78USrm6R3H4m4igjPepG5B88tJ216DT8Gv" as const,
			fee: {
				fee: 0n,
				native_fee: 4996147724985508560896n,
			},
			sender: "near:intents.near" as const,
			msg: "",
		};

		const accountId = calculateStorageAccountId(transferMessage);

		expect(accountId).toBe(
			"bff694d8802e268908ea311a613331eaa278628b55ab4adbe850fd3aa2e3cc7c",
		);
	});

	it("calculates consistent storage account ID for the same input", () => {
		const transferMessage = {
			token: "near:token.near" as const,
			amount: 1000000000000000000000000n,
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 100000000000000000000000n,
				native_fee: 1000000000000000000000n,
			},
			sender: "near:sender.near" as const,
			msg: "test transfer",
		};

		const accountId1 = calculateStorageAccountId(transferMessage);
		const accountId2 = calculateStorageAccountId(transferMessage);

		expect(accountId1).toBe(accountId2);
		expect(accountId1).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces different account IDs for different inputs", () => {
		const baseMessage = {
			token: "near:token.near" as const,
			amount: 1000000000000000000000000n,
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 100000000000000000000000n,
				native_fee: 1000000000000000000000n,
			},
			sender: "near:sender.near" as const,
			msg: "test transfer",
		};

		const message1 = { ...baseMessage };
		const message2 = { ...baseMessage, amount: 2000000000000000000000000n };
		const message3 = { ...baseMessage, msg: "different message" };

		const accountId1 = calculateStorageAccountId(message1);
		const accountId2 = calculateStorageAccountId(message2);
		const accountId3 = calculateStorageAccountId(message3);

		expect(accountId1).not.toBe(accountId2);
		expect(accountId1).not.toBe(accountId3);
		expect(accountId2).not.toBe(accountId3);
	});

	it("handles different chain prefixes", () => {
		const messages = [
			{
				token: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
				amount: 1000000000000000000n,
				recipient: "near:recipient.near" as const,
				fee: { fee: 100000000000000000n, native_fee: 1000000000000000n },
				sender: "eth:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" as const,
				msg: "",
			},
			{
				token: "sol:11111111111111111111111111111112" as const,
				amount: 1000000000n,
				recipient: "near:recipient.near" as const,
				fee: { fee: 10000000n, native_fee: 1000000n },
				sender: "sol:So11111111111111111111111111111111111111112" as const,
				msg: "",
			},
			{
				token: "near:token.near" as const,
				amount: 1000000000000000000000000n,
				recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
				fee: {
					fee: 100000000000000000000000n,
					native_fee: 1000000000000000000000n,
				},
				sender: "near:sender.near" as const,
				msg: "",
			},
		];

		const accountIds = messages.map(calculateStorageAccountId);

		// All should be valid hex strings of 64 characters (32 bytes)
		for (const accountId of accountIds) {
			expect(accountId).toMatch(/^[a-f0-9]{64}$/);
		}

		// All should be different
		expect(new Set(accountIds).size).toBe(accountIds.length);
	});

	it("handles zero amounts", () => {
		const transferMessage = {
			token: "near:token.near" as const,
			amount: 0n,
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 0n,
				native_fee: 0n,
			},
			sender: "near:sender.near" as const,
			msg: "",
		};

		const accountId = calculateStorageAccountId(transferMessage);
		expect(accountId).toMatch(/^[a-f0-9]{64}$/);
	});

	it("handles large amounts", () => {
		const transferMessage = {
			token: "near:token.near" as const,
			amount: 340282366920938463463374607431768211455n, // Max U128
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 1000000000000000000000000n,
				native_fee: 100000000000000000000000n,
			},
			sender: "near:sender.near" as const,
			msg: "large amount test",
		};

		const accountId = calculateStorageAccountId(transferMessage);
		expect(accountId).toMatch(/^[a-f0-9]{64}$/);
	});

	it("handles empty and long messages", () => {
		const baseMessage = {
			token: "near:token.near" as const,
			amount: 1000000000000000000000000n,
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 100000000000000000000000n,
				native_fee: 1000000000000000000000n,
			},
			sender: "near:sender.near" as const,
			msg: "",
		};

		const emptyMessage = { ...baseMessage, msg: "" };
		const longMessage = { ...baseMessage, msg: "x".repeat(1000) };

		const emptyAccountId = calculateStorageAccountId(emptyMessage);
		const longAccountId = calculateStorageAccountId(longMessage);

		expect(emptyAccountId).toMatch(/^[a-f0-9]{64}$/);
		expect(longAccountId).toMatch(/^[a-f0-9]{64}$/);
		expect(emptyAccountId).not.toBe(longAccountId);
	});

	it("handles special characters in messages", () => {
		const transferMessage = {
			token: "near:token.near" as const,
			amount: 1000000000000000000000000n,
			recipient: "eth:0x742d35Cc6734C0532925a3b8D84f8FBf4D7bE86f" as const,
			fee: {
				fee: 100000000000000000000000n,
				native_fee: 1000000000000000000000n,
			},
			sender: "near:sender.near" as const,
			msg: "🚀 Unicode test! 特殊文字 №123 @#$%^&*()",
		};

		const accountId = calculateStorageAccountId(transferMessage);
		expect(accountId).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces deterministic results across multiple calls", () => {
		const transferMessage = {
			token: "near:usdc.near" as const,
			amount: 123456789000000n,
			recipient: "sol:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" as const,
			fee: {
				fee: 123456000000n,
				native_fee: 987654000000000000000n,
			},
			sender: "near:alice.near" as const,
			msg: "Cross-chain transfer",
		};

		// Call the function multiple times to ensure deterministic behavior
		const results = Array.from({ length: 10 }, () =>
			calculateStorageAccountId(transferMessage),
		);

		// All results should be identical
		const firstResult = results[0];
		expect(results.every((result) => result === firstResult)).toBe(true);
		expect(firstResult).toMatch(/^[a-f0-9]{64}$/);
	});
});

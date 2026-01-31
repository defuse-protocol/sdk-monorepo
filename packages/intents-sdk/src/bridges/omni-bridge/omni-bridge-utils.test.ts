import { describe, expect, it } from "vitest";
import {
	caip2ToChainKind,
	chainKindToCaip2,
	createWithdrawIntentsPrimitive,
	getBridgedToken,
	getAccountOmniStorageBalance,
	getTokenDecimals,
	isUtxoChain,
	validateOmniToken,
} from "./omni-bridge-utils";
import {
	assert,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress } from "@omni-bridge/core";
import { Chains } from "../../lib/caip2";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";

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

	it("throws for NEAR addresses", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(nearProvider, "near:token.near"),
		).rejects.toThrow("Token decimals cannot be queried using NEAR addresses");
	});
});

describe("caip2ToChainKind()", () => {
	it("maps Ethereum to Eth", () => {
		expect(caip2ToChainKind(Chains.Ethereum)).toBe(ChainKind.Eth);
	});

	it("maps Solana to Sol", () => {
		expect(caip2ToChainKind(Chains.Solana)).toBe(ChainKind.Sol);
	});

	it("maps Bitcoin to Btc", () => {
		expect(caip2ToChainKind(Chains.Bitcoin)).toBe(ChainKind.Btc);
	});

	it("returns null for unsupported chain", () => {
		expect(caip2ToChainKind(Chains.TON)).toBeNull();
	});
});

describe("chainKindToCaip2()", () => {
	it("maps Eth to Ethereum", () => {
		expect(chainKindToCaip2(ChainKind.Eth)).toBe(Chains.Ethereum);
	});

	it("maps Sol to Solana", () => {
		expect(chainKindToCaip2(ChainKind.Sol)).toBe(Chains.Solana);
	});

	it("returns null for unsupported ChainKind", () => {
		expect(chainKindToCaip2(ChainKind.Near)).toBeNull();
	});
});

describe("isUtxoChain()", () => {
	it("returns true for Bitcoin", () => {
		expect(isUtxoChain(ChainKind.Btc)).toBe(true);
	});

	it("returns false for Ethereum", () => {
		expect(isUtxoChain(ChainKind.Eth)).toBe(false);
	});

	it("returns false for Solana", () => {
		expect(isUtxoChain(ChainKind.Sol)).toBe(false);
	});
});

describe("createWithdrawIntentsPrimitive()", () => {
	it("creates intent for EVM chain without native fee", () => {
		const result = createWithdrawIntentsPrimitive({
			assetId: "nep141:eth.bridge.near",
			destinationAddress: "0x1234567890123456789012345678901234567890",
			amount: 1000n,
			nativeFee: 0n,
			storageDepositAmount: 0n,
			omniChainKind: ChainKind.Eth,
			intentsContract: "intents.near",
			utxoMaxGasFee: null,
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			intent: "ft_withdraw",
			token: "eth.bridge.near",
			receiver_id: OMNI_BRIDGE_CONTRACT,
			amount: "1000",
		});
	});

	it("includes storage_deposit intent when nativeFee > 0", () => {
		const result = createWithdrawIntentsPrimitive({
			assetId: "nep141:eth.bridge.near",
			destinationAddress: "0x1234567890123456789012345678901234567890",
			amount: 1000n,
			nativeFee: 500n,
			storageDepositAmount: 0n,
			omniChainKind: ChainKind.Eth,
			intentsContract: "intents.near",
			utxoMaxGasFee: null,
		});

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			intent: "storage_deposit",
			amount: "500",
			contract_id: OMNI_BRIDGE_CONTRACT,
		});
		expect(result[1]).toMatchObject({
			intent: "ft_withdraw",
		});
	});

	it("includes maxGasFee for Bitcoin withdrawals", () => {
		const result = createWithdrawIntentsPrimitive({
			assetId: "nep141:btc.bridge.near",
			destinationAddress: "bc1qtest",
			amount: 1000n,
			nativeFee: 0n,
			storageDepositAmount: 0n,
			omniChainKind: ChainKind.Btc,
			intentsContract: "intents.near",
			utxoMaxGasFee: 100n,
		});

		expect(result).toHaveLength(1);

		const ftWithdraw = result[0];
		expect(ftWithdraw).toHaveProperty("intent", "ft_withdraw");

		assert(ftWithdraw != null && ftWithdraw.intent === "ft_withdraw"); // typeguard
		assert(typeof ftWithdraw.msg === "string"); // typeguard

		expect(JSON.parse(ftWithdraw.msg)).toHaveProperty(
			"msg",
			'{"MaxGasFee":"100"}',
		);
	});

	it("throws for Bitcoin without utxoMaxGasFee", () => {
		expect(() =>
			createWithdrawIntentsPrimitive({
				assetId: "nep141:btc.bridge.near",
				destinationAddress: "bc1qtest",
				amount: 1000n,
				nativeFee: 0n,
				storageDepositAmount: 0n,
				omniChainKind: ChainKind.Btc,
				intentsContract: "intents.near",
				utxoMaxGasFee: null,
			}),
		).toThrow("Invalid utxo max gas fee");
	});

	it("throws for non NEP-141 assets", () => {
		expect(() =>
			createWithdrawIntentsPrimitive({
				assetId: "nep245:token.near:1",
				destinationAddress: "0x1234567890123456789012345678901234567890",
				amount: 1000n,
				nativeFee: 0n,
				storageDepositAmount: 0n,
				omniChainKind: ChainKind.Eth,
				intentsContract: "intents.near",
				utxoMaxGasFee: null,
			}),
		).toThrow("Only NEP-141 is supported");
	});
});

import { describe, expect, it } from "vitest";
import {
	getBridgedToken,
	getAccountOmniStorageBalance,
	getTokenDecimals,
	validateOmniToken,
} from "./omni-bridge-utils";
import {
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress } from "omni-bridge-sdk";

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

describe("Contract query utils", () => {
	const nearProvider = nearFailoverRpcProvider({ urls: PUBLIC_NEAR_RPC_URLS });
	describe("getAccountOmniStorageBalance()", () => {
		it("fetches omni storage balance and parses it successfully", async () => {
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
			// Aurora
			const nearAddress =
				"near:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near";
			const result = await getBridgedToken(
				nearProvider,
				nearAddress,
				ChainKind.Eth,
			);
			await expect(result).toBe(
				"eth:0xaaaaaa20d9e0e2461697782ef11675f668207961",
			);
		});
		it("resolves a token from NEAR to BASE directly", async () => {
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
			// Aurora
			const nearAddress = "near:wrap.near";
			const result = await getBridgedToken(
				nearProvider,
				nearAddress,
				ChainKind.Arb,
			);
			await expect(result).toBe(
				"arb:0x02eea354d135d1a912967c2d2a6147deb01ef92e",
			);
		});

		it("returns null for unregistered tokens", async () => {
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
});

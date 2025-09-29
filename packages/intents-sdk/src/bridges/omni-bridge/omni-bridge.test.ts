import { describe, expect, it } from "vitest";
import { OmniBridge } from "./omni-bridge";
import {
	getBridgedToken,
	getIntentsOmniStorageBalance,
	getTokenDecimals,
	validateOmniToken,
} from "./omni-bridge-utils";
import { createOmniBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { UnsupportedAssetIdError } from "../../classes/errors";
import { TokenNotFoundInDestinationChainError } from "./error";
import {
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress } from "omni-bridge-sdk";

describe("OmniBridge", () => {
	const nearProvider = nearFailoverRpcProvider({ urls: PUBLIC_NEAR_RPC_URLS });
	describe("validateOmniToken() works for valid token formats", () => {
		it.each([
			"eth.bridge.near",
			"sol.omdep.near",
			"base.omdep.near",
			"arb.omdep.near",
			"foo.omdep.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
			"sol-ABC123.omdep.near",
			"arb-ABC123.omdep.near",
			"base-ABC123.omdep.near",
		])("validate", async (assetId) => {
			expect(validateOmniToken(assetId)).toBe(true);
		});
		it.each([
			"eth.Hellobridge.near",
			"sol-ABC123.test.hello.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridgeomni.near",
			"btc.omft.near",
			"v3_1.omni.hot.tg:56_11111111111111111111",
			"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", // USDC
		])("validate", async (assetId) => {
			expect(validateOmniToken(assetId)).toBe(false);
		});
	});
	describe.sequential("supports()", () => {
		it.each([
			"nep141:eth.bridge.near",
			"nep141:sol.omdep.near",
			"nep141:base.omdep.near",
			"nep141:arb.omdep.near",
			"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
		])("supports basic omni tokens", async (assetId) => {
			const bridge = new OmniBridge({
				env: "production",
				nearProvider,
			});

			await expect(bridge.supports({ assetId: assetId })).resolves.toBe(true);
		});

		it.each([
			{
				assetId: "nep141:token.publicailab.near",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			},
		])(
			"supports near native token withdrawals to specific chains where this token is deployed",
			async ({ assetId, routeConfig }) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId, routeConfig })).resolves.toBe(
					true,
				);
			},
		);

		it.each([
			{
				assetId: "nep245:v3_1.omni.hot.tg:56_11111111111111111111",
				routeConfig: createOmniBridgeRoute(),
			},
		])(
			"throws UnsupportedAssetIdError if trying to bridge to origin chain with unsupported standard but set routeConfig",
			async ({ assetId, routeConfig }) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					UnsupportedAssetIdError,
				);
			},
		);

		it.each([
			{
				assetId: "nep141:eth.bridge.fake.near",
				routeConfig: createOmniBridgeRoute(),
			},
		])(
			"throws UnsupportedAssetIdError if trying to bridge to origin chain with invalid token format",
			async ({ assetId, routeConfig }) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					UnsupportedAssetIdError,
				);
			},
		);

		it.each([
			"nep141:btc.omft.near",
			"nep141:wrap.near",
			"nep141:token.publicailab.near",
			"nep141:token.sweat",
		])(
			"does not support near native token without specific chain indicated",
			async (assetId) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId })).resolves.toBe(false);
			},
		);

		it.each([
			"nep245:v3_1.omni.hot.tg:56_11111111111111111111",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
		])("doesn't support non omni tokens", async (assetId) => {
			const bridge = new OmniBridge({
				env: "production",
				nearProvider,
			});

			await expect(bridge.supports({ assetId: assetId })).resolves.toBe(false);
		});

		it.each([
			{
				assetId: "nep141:token.publicailab.near",
				routeConfig: createOmniBridgeRoute(Chains.Dogecoin),
			},
			{
				assetId: "nep141:nbtc.bridge.near",
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
		])(
			"throws UnsupportedAssetIdError if trying to bridge a token to unsupported chain",
			async ({ assetId, routeConfig }) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					UnsupportedAssetIdError,
				);
			},
		);

		it.each([
			{
				assetId: "nep141:btc.omft.near",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			},
		])(
			"throws TokenNotFoundInDestinationChainError if routeConfig passed, but assetId is not found in destination chain token",
			async ({ assetId, routeConfig }) => {
				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					TokenNotFoundInDestinationChainError,
				);
			},
		);
	});
	describe("getIntentsOmniStorageBalance()", () => {
		it("fetches omni storage balance and parses it successfully", async () => {
			await expect(getIntentsOmniStorageBalance(nearProvider)).resolves.toEqual(
				{
					total: expect.any(String),
					available: expect.any(String),
				},
			);
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
			expect(result).toBe("sol:AXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS");
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
			expect(result).toBe("eth:0xaaaaaa20d9e0e2461697782ef11675f668207961");
		});
		it("resolves a token from NEAR to BASE directly", async () => {
			const nearAddress = "near:wrap.near";
			const result = await getBridgedToken(
				nearProvider,
				nearAddress,
				ChainKind.Base,
			);
			expect(result).toBe("base:0x02eea354d135d1a912967c2d2a6147deb01ef92e");
		});
		it("resolves a token from NEAR to ARB directly", async () => {
			// Aurora
			const nearAddress = "near:wrap.near";
			const result = await getBridgedToken(
				nearProvider,
				nearAddress,
				ChainKind.Arb,
			);
			expect(result).toBe("arb:0x02eea354d135d1a912967c2d2a6147deb01ef92e");
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
			expect(
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
			expect(
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

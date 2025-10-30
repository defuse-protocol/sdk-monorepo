import { describe, expect, it } from "vitest";
import { HotBridge } from "./hot-bridge";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import hotOmniSdk from "@hot-labs/omni-sdk";
import { createHotBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { zeroAddress } from "viem";
import { PUBLIC_NEAR_RPC_URLS } from "@defuse-protocol/internal-utils";
import {
	configureEvmRpcUrls,
	configureStellarRpcUrls,
} from "../../lib/configure-rpc-config";
import {
	PUBLIC_EVM_RPC_URLS,
	PUBLIC_STELLAR_RPC_URLS,
} from "../../constants/public-rpc-urls";
import { HotBridgeEVMChains } from "./hot-bridge-chains";
import isHex from "../../lib/isHex";

describe("HotBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
			// todo: add more test cases for each supported chain
		])("supports `v2_1.omni.hot.tg` tokens", async (tokenId) => {
			const bridge = new HotBridge({
				env: "production",
				hotSdk: new hotOmniSdk.HotBridge({
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			});

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createHotBridgeRoute(Chains.TON),
				}),
			).resolves.toBe(true);
		});

		it.each([
			"nep141:btc.omft.near",
			"nep245:v3_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support `v2_1.omni.hot.tg` tokens", async (tokenId) => {
			const bridge = new HotBridge({
				env: "production",
				hotSdk: new hotOmniSdk.HotBridge({
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			});
			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(false);
		});

		it.each([
			"nep141:v2_1.omni.hot.tg:56_11111111111111111111",
			"nep245:v2_1.omni.hot.tg",
			"nep245:v2_1.omni.hot.tg:FOOBAR",
		])(
			"throws UnsupportedAssetIdError if misspelled HOT token",
			async (assetId) => {
				const bridge = new HotBridge({
					env: "production",
					hotSdk: new hotOmniSdk.HotBridge({
						async executeNearTransaction() {
							throw new Error("not implemented");
						},
					}),
				});

				await expect(bridge.supports({ assetId: assetId })).rejects.toThrow(
					UnsupportedAssetIdError,
				);

				// It throws even if routeConfig is provided.
				await expect(
					bridge.supports({
						assetId: assetId,
						routeConfig: createHotBridgeRoute(Chains.TON),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);

		it.each(["invalid_string", "nep141:wrap.near", "nep141:btc.omft.near"])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not HOT token",
			async (assetId) => {
				const bridge = new HotBridge({
					env: "production",
					hotSdk: new hotOmniSdk.HotBridge({
						async executeNearTransaction() {
							throw new Error("not implemented");
						},
					}),
				});

				await expect(
					bridge.supports({
						assetId,
						routeConfig: createHotBridgeRoute(Chains.TON),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});

	describe("validateWithdrawal()", () => {
		it.each([
			{
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				destinationAddress: zeroAddress,
			}, // UDSC Polygon
			{
				assetId:
					"nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu",
				destinationAddress:
					"GAEQ3MB7PSTGWKH2GK7O3HK5AKGH2RHVS4X7GDXV7BMX2GK4VL7GDHKD",
			}, // UDSC Stellar
			{
				assetId:
					"nep245:v2_1.omni.hot.tg:1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR",
				destinationAddress: "EQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bL",
			}, // UDST Ton
		])("allows correct addresses", async ({ assetId, destinationAddress }) => {
			const stellarRpcUrls = configureStellarRpcUrls(
				PUBLIC_STELLAR_RPC_URLS,
				{},
			);

			const evmRpcUrls = configureEvmRpcUrls(
				PUBLIC_EVM_RPC_URLS,
				{},
				HotBridgeEVMChains,
			);

			const bridge = new HotBridge({
				env: "production",
				hotSdk: new hotOmniSdk.HotBridge({
					logger: console,
					evmRpc: evmRpcUrls,
					// 1. HotBridge from omni-sdk does not support FailoverProvider.
					// 2. omni-sdk has near-api-js@5.0.1, and it uses `instanceof` which doesn't work when multiple versions of packages are installed
					nearRpc: PUBLIC_NEAR_RPC_URLS,
					stellarRpc: stellarRpcUrls.soroban,
					stellarHorizonRpc: stellarRpcUrls.horizon,
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			});

			await expect(
				bridge.validateWithdrawal({
					amount: 1n,
					assetId,
					destinationAddress,
				}),
			).resolves.toBeUndefined();
		});
		it.each([
			{
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				destinationAddress:
					"GAXQC6TWRKQ4TK7OVADU2DQMXHFYUDHGO6JIIIHLDD7RTBHYHXPSNUTV",
			}, // UDSC Polygon
			{
				assetId:
					"nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu",
				destinationAddress: "test.near",
			}, // UDSC Stellar
			{
				assetId:
					"nep245:v2_1.omni.hot.tg:1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR",
				destinationAddress: zeroAddress,
			}, // UDST Ton
		])(
			"blocks non corresponding addresses",
			async ({ assetId, destinationAddress }) => {
				const bridge = new HotBridge({
					env: "production",
					hotSdk: {} as any,
				});

				await expect(
					bridge.validateWithdrawal({
						assetId,
						amount: 1n,
						destinationAddress,
					}),
				).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
			},
		);
	});

	describe("isHex()", () => {
		it.each([
			"9b946b769a71dfacf62daa68e3d94f60b9df3ffd1b9ec4ac9258b56e890022ae", //BNB
			"eb77be889cb6dd8112af0f750959b19da0899460e154e5ae7d01000cce23e371", // POLYGON
			"6cb1992e56cb0941bcd4d1ecf557d32ff1f4c4ac89e92e4b6849f812f61512d4", // TON
			"b45ff715159772bd5ce04fa124657782a95e799bfcb62882ba2d95bd946300d2", // OPTIMISM
			"6286537ea071852d259a9db1b58f86edb49ec18ccab24f8263a4c525d653cff5", // AVALANCHE
			"8d4f5c6b6d7337f7cf730ea04386f29ec064ded83c5d939d64758cc94a2eb0d6", // STELLAR
		])("return true for valid non 0x prefixed strings", async (value) => {
			expect(isHex(value)).toBe(true);
		});
		it.each(["Withdrawal already processed", "Random string", "0x123"])(
			"block any other string and 0x prefix strings",
			async (value) => {
				expect(isHex(value)).toBe(false);
			},
		);
	});
});

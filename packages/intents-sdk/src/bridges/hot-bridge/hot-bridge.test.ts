import { describe, expect, it } from "vitest";
import { HotBridge } from "./hot-bridge";
import { UnsupportedAssetIdError } from "../../classes/errors";
import hotOmniSdk from "@hot-labs/omni-sdk";
import { createHotBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { zeroAddress } from "viem";

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

			await expect(
				bridge.supports({ assetId: tokenId, destinationAddress: zeroAddress }),
			).resolves.toBe(true);
			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createHotBridgeRoute(Chains.BNB),
					destinationAddress: zeroAddress,
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
			await expect(
				bridge.supports({ assetId: tokenId, destinationAddress: "test" }),
			).resolves.toBe(false);
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

				await expect(
					bridge.supports({ assetId: assetId, destinationAddress: "test" }),
				).rejects.toThrow(UnsupportedAssetIdError);

				// It throws even if routeConfig is provided.
				await expect(
					bridge.supports({
						assetId: assetId,
						routeConfig: createHotBridgeRoute(Chains.TON),
						destinationAddress:
							"UQCMOXxD-f8LSWWbXQowKxqTr3zMY-X1wMTyWp3B-LR6syif",
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
						destinationAddress:
							"UQCMOXxD-f8LSWWbXQowKxqTr3zMY-X1wMTyWp3B-LR6syif",
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
});

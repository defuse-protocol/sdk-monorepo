import { describe, expect, it } from "vitest";
import { HotBridge } from "./hot-bridge";
import { UnsupportedAssetIdError } from "../../classes/errors";
import hotOmniSdk from "@hot-labs/omni-sdk";
import { createHotBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";

describe("HotBridge", () => {
	it.each([
		"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		// todo: add more test cases for each supported chain
	])("supports %s", async (tokenId) => {
		const bridge = new HotBridge({
			env: "production",
			hotSdk: new hotOmniSdk.HotBridge({
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			}),
		});

		await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
	});

	it.each(["nep141:btc.omft.near"])("does not support %s", async (tokenId) => {
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
		"invalid_string",
		"nep141:v2_1.omni.hot.tg:56_11111111111111111111",
		"nep245:v2_1.omni.hot.tg",
		"nep245:v2_1.omni.hot.tg:FOOBAR",
	])("throws UnsupportedAssetIdError if invalid %s", async (assetId) => {
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
		await expect(() =>
			bridge.supports({
				assetId: assetId,
				routeConfig: createHotBridgeRoute(Chains.TON),
			}),
		).rejects.toThrow(UnsupportedAssetIdError);
	});

	it("throws UnsupportedAssetIdError if routeConfig specified but assetId is not HOT token", async () => {
		const bridge = new HotBridge({
			env: "production",
			hotSdk: new hotOmniSdk.HotBridge({
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			}),
		});

		await expect(() =>
			bridge.supports({
				assetId: "nep141:wrap.near",
				routeConfig: createHotBridgeRoute(Chains.TON),
			}),
		).rejects.toThrow(UnsupportedAssetIdError);
	});
});

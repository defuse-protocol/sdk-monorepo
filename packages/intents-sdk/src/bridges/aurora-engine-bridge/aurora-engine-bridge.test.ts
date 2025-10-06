import { describe, expect, it } from "vitest";
import { UnsupportedAssetIdError } from "../../classes/errors";
import { createVirtualChainRoute } from "../../lib/route-config-factory";
import { AuroraEngineBridge } from "./aurora-engine-bridge";

describe("AuroraEngineBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			"nep141:wrap.near",
		])("supports NEP-141 if routeConfig passed", async (tokenId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createVirtualChainRoute("", null),
				}),
			).resolves.toBe(true);
		});

		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support any if routeConfig not passed", async (tokenId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(
				bridge.supports({
					assetId: tokenId,
				}),
			).resolves.toBe(false);
		});

		it.each([
			"invalid_string",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not NEP-141 token",
			async (assetId) => {
				const bridge = new AuroraEngineBridge({
					env: "production",
					nearProvider: {} as any,
				});

				await expect(
					bridge.supports({
						assetId: assetId,
						routeConfig: createVirtualChainRoute("", null),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
});

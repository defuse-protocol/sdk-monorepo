import { describe, expect, it } from "vitest";
import { UnsupportedAssetIdError } from "../../classes/errors";
import { createVirtualChainRoute } from "../../lib/route-config-factory";
import { AuroraEngineBridge } from "./aurora-engine-bridge";

describe("AuroraEngineBridge", () => {
	it.each([
		"nep141:btc.omft.near",
		"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
	])("supports %s", async (tokenId) => {
		const bridge = new AuroraEngineBridge({
			env: "production",
			nearProvider: {} as any,
		});

		await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
	});

	it.each(["nep245:v2_1.omni.hot.tg:56_11111111111111111111"])(
		"does not support %s",
		async (tokenId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(false);
		},
	);

	it.each(["invalid_string"])(
		"throws UnsupportedAssetIdError if invalid %s",
		async (assetId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(bridge.supports({ assetId })).rejects.toThrow(
				UnsupportedAssetIdError,
			);

			// It throws even if routeConfig is provided.
			await expect(() =>
				bridge.supports({
					assetId,
					routeConfig: createVirtualChainRoute("", null),
				}),
			).rejects.toThrow(UnsupportedAssetIdError);
		},
	);

	it("throws UnsupportedAssetIdError if routeConfig specified but assetId is not NEP-141 token", async () => {
		const bridge = new AuroraEngineBridge({
			env: "production",
			nearProvider: {} as any,
		});

		await expect(() =>
			bridge.supports({
				assetId: "nep245:wrap.near:foo",
				routeConfig: createVirtualChainRoute("", null),
			}),
		).rejects.toThrow(UnsupportedAssetIdError);
	});
});

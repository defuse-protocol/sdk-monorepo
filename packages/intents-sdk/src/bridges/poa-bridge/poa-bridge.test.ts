import { describe, expect, it } from "vitest";
import { PoaBridge } from "./poa-bridge";
import { UnsupportedAssetIdError } from "../../classes/errors";
import { createPoaBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";

describe("PoaBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
		])("supports `omft.near` tokens", async (tokenId) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createPoaBridgeRoute(Chains.Bitcoin),
				}),
			).resolves.toBe(true);
		});

		it.each([
			"nep141:wrap.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support not `omft.near` tokens", async (tokenId) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(false);
		});

		it.each(["nep141:bitcoin.omft.near", "nep141:unknown.omft.near"])(
			"throws UnsupportedAssetIdError if misspelled POA token",
			async (assetId) => {
				const bridge = new PoaBridge({ env: "production" });

				await expect(bridge.supports({ assetId })).rejects.toThrow(
					UnsupportedAssetIdError,
				);

				// It throws even if routeConfig is provided.
				await expect(
					bridge.supports({
						assetId,
						routeConfig: createPoaBridgeRoute(Chains.Arbitrum),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);

		it.each([
			"invalid_string",
			"nep141:wrap.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not POA token",
			async (assetId) => {
				const bridge = new PoaBridge({ env: "production" });

				await expect(
					bridge.supports({
						assetId,
						routeConfig: createPoaBridgeRoute(Chains.Bitcoin),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
});

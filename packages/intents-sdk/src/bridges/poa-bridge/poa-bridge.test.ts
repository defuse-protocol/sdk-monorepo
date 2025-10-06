import { describe, expect, it } from "vitest";
import { PoaBridge } from "./poa-bridge";
import { UnsupportedAssetIdError } from "../../classes/errors";
import { createPoaBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { zeroAddress } from "viem";

describe("PoaBridge", () => {
	describe("supports()", () => {
		it.each([
			{
				assetId: "nep141:btc.omft.near",
				destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
			},
			{
				assetId:
					"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
				routeConfig: createPoaBridgeRoute(Chains.Ethereum),
				destinationAddress: zeroAddress,
			},
		])("supports `omft.near` tokens", async (params) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(bridge.supports(params)).resolves.toBe(true);
		});

		it.each([
			"nep141:wrap.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support not `omft.near` tokens", async (tokenId) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(
				bridge.supports({ assetId: tokenId, destinationAddress: "test" }),
			).resolves.toBe(false);
		});

		it.each(["nep141:bitcoin.omft.near", "nep141:unknown.omft.near"])(
			"throws UnsupportedAssetIdError if misspelled POA token",
			async (assetId) => {
				const bridge = new PoaBridge({ env: "production" });

				await expect(
					bridge.supports({ assetId, destinationAddress: "test" }),
				).rejects.toThrow(UnsupportedAssetIdError);

				// It throws even if routeConfig is provided.
				await expect(
					bridge.supports({
						assetId,
						routeConfig: createPoaBridgeRoute(Chains.Arbitrum),
						destinationAddress: zeroAddress,
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
						destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
});

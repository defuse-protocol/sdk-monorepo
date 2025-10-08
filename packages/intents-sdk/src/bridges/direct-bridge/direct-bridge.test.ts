import { describe, expect, it } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { createNearWithdrawalRoute } from "../../lib/route-config-factory";
import { DirectBridge } from "./direct-bridge";
import { zeroAddress } from "viem";

describe("DirectBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
		])("supports NEP-141 even if routeConfig not passed", async (tokenId) => {
			const bridge = new DirectBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createNearWithdrawalRoute(),
				}),
			).resolves.toBe(true);
		});

		it.each(["nep245:v2_1.omni.hot.tg:56_11111111111111111111"])(
			"doesn't support NEP-245",
			async (tokenId) => {
				const bridge = new DirectBridge({
					env: "production",
					nearProvider: {} as any,
				});

				await expect(
					bridge.supports({
						assetId: tokenId,
					}),
				).resolves.toBe(false);
			},
		);

		it.each([
			"invalid_string",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not NEP-141",
			async (assetId) => {
				const bridge = new DirectBridge({
					env: "production",
					nearProvider: {} as any,
				});

				await expect(
					bridge.supports({
						assetId,
						routeConfig: createNearWithdrawalRoute(),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
	describe("validateWithdrawal()", () => {
		it.each(["user.near", "aurora", zeroAddress])(
			"allows EVM and regular addresses",
			async (destinationAddress) => {
				const bridge = new DirectBridge({
					env: "production",
					nearProvider: {} as any,
				});

				await expect(
					bridge.validateWithdrawal({
						assetId: "nep141:wrap.near",
						amount: 1n,
						destinationAddress,
					}),
				).resolves.toBeUndefined();
			},
		);
		it.each([
			"a", // Invalid NEAR address (less than two characters)
			// Any string with no uppercase is technically a valid NEAR address (if it is at least two characters long)
			// so I leave only one solana address here
			"9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R", // Solana
		])("blocks non NEAR addresses", async (destinationAddress) => {
			const bridge = new DirectBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:wrap.near",
					amount: 1n,
					destinationAddress,
				}),
			).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
		});
	});
});

import { describe, expect, it } from "vitest";
import { OmniBridge } from "./omni-bridge";
import { createOmniBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { TokenNotFoundInDestinationChainError } from "./error";
import {
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { zeroAddress } from "viem";

describe("OmniBridge", () => {
	describe("without routeConfig", () => {
		it("supports if assetId matches omni pattern (token created by specific factories)", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				env: "production",
				nearProvider,
			});

			const assetIds = [
				"nep141:eth.bridge.near",
				"nep141:sol.omdep.near",
				"nep141:base.omdep.near",
				"nep141:arb.omdep.near",
				"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
			];

			for (const assetId of assetIds) {
				await expect(bridge.supports({ assetId })).resolves.toBe(true);
			}
		});

		it("doesn't support if assetId doesn't match omni pattern", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				env: "production",
				nearProvider,
			});

			const assetIds = [
				"nep141:btc.omft.near",
				"nep141:wrap.near",
				"nep141:token.publicailab.near",
				"nep141:token.sweat",
				"nep245:v3_1.omni.hot.tg:56_11111111111111111111",
				"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			];

			for (const assetId of assetIds) {
				await expect(bridge.supports({ assetId })).resolves.toBe(false);
			}
		});
	});

	describe("supports()", () => {
		describe("with routeConfig", () => {
			it("supports if token with origin on NEAR has a bridged version on other chain", async () => {
				const nearProvider = nearFailoverRpcProvider({
					urls: PUBLIC_NEAR_RPC_URLS,
				});

				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				const assetId = "nep141:token.publicailab.near";
				const routeConfig = createOmniBridgeRoute(Chains.Solana);

				await expect(bridge.supports({ assetId, routeConfig })).resolves.toBe(
					true,
				);
			});

			it("throws UnsupportedAssetIdError if assetId not nep141 standard", async () => {
				const nearProvider = nearFailoverRpcProvider({
					urls: PUBLIC_NEAR_RPC_URLS,
				});

				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				const assetId = "nep245:v3_1.omni.hot.tg:56_11111111111111111111";
				const routeConfig = createOmniBridgeRoute();

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					UnsupportedAssetIdError,
				);
			});

			it("throws UnsupportedAssetIdError if assetId doesn't match omni pattern", async () => {
				const nearProvider = nearFailoverRpcProvider({
					urls: PUBLIC_NEAR_RPC_URLS,
				});

				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				const assetId = "nep141:eth.bridge.fake.near";
				const routeConfig = createOmniBridgeRoute();

				await expect(bridge.supports({ assetId, routeConfig })).rejects.toThrow(
					UnsupportedAssetIdError,
				);
			});

			it.each([
				{
					assetId: "nep141:token.publicailab.near",
					routeConfig: createOmniBridgeRoute(Chains.Dogecoin),
				},
			])(
				"throws UnsupportedAssetIdError if trying to bridge a token to unsupported chain",
				async ({ assetId, routeConfig }) => {
					const nearProvider = nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					});

					const bridge = new OmniBridge({
						env: "production",
						nearProvider,
					});

					await expect(
						bridge.supports({ assetId, routeConfig }),
					).rejects.toThrow(UnsupportedAssetIdError);
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
					const nearProvider = nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					});

					const bridge = new OmniBridge({
						env: "production",
						nearProvider,
					});

					await expect(
						bridge.supports({ assetId, routeConfig }),
					).rejects.toThrow(TokenNotFoundInDestinationChainError);
				},
			);
		});
	});

	describe("validateWithdrawal()", () => {
		it.each([
			{
				assetId:
					"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
				destinationAddress: zeroAddress,
				routeConfig: undefined,
			}, // Aurora token
			{
				assetId: "nep141:token.publicailab.near",
				destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			}, // Public ai
		])(
			"allows correct addresses",
			async ({ assetId, destinationAddress, routeConfig }) => {
				const nearProvider = nearFailoverRpcProvider({
					urls: PUBLIC_NEAR_RPC_URLS,
				});

				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(
					bridge.validateWithdrawal({
						amount: 1000000000000000n,
						assetId,
						destinationAddress,
						feeEstimation: {
							amount: 25_000_000_000n,
							quote: null,
						},
						routeConfig,
					}),
				).resolves.toBeUndefined();
			},
		);
		it.each([
			{
				assetId:
					"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
				destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
				routeConfig: undefined,
			}, // Aurora token
			{
				assetId: "nep141:token.publicailab.near",
				destinationAddress: zeroAddress,
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			}, // Public ai
		])(
			"blocks non corresponding addresses",
			async ({ assetId, destinationAddress, routeConfig }) => {
				const nearProvider = nearFailoverRpcProvider({
					urls: PUBLIC_NEAR_RPC_URLS,
				});

				const bridge = new OmniBridge({
					env: "production",
					nearProvider,
				});

				await expect(
					bridge.validateWithdrawal({
						amount: 1000000000000000n,
						assetId,
						destinationAddress,
						feeEstimation: {
							amount: 25_000_000_000n,
							quote: null,
						},
						routeConfig,
					}),
				).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
			},
		);
	});
});

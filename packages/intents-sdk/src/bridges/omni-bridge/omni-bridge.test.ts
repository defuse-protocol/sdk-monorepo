import { describe, expect, it } from "vitest";
import { OmniBridge } from "./omni-bridge";
import { createOmniBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { UnsupportedAssetIdError } from "../../classes/errors";
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

			const params = [
				{ assetId: "nep141:eth.bridge.near", destinationAddress: zeroAddress },
				{
					assetId: "nep141:sol.omdep.near",
					destinationAddress: "HuTshmtwcQkWBLzgW3m4uwcmik7Lmz4YFpYcTqMJpXiP",
				},
				{ assetId: "nep141:base.omdep.near", destinationAddress: zeroAddress },
				{ assetId: "nep141:arb.omdep.near", destinationAddress: zeroAddress },
				{
					assetId:
						"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
					destinationAddress: zeroAddress,
				},
			];

			for (const param of params) {
				await expect(bridge.supports(param)).resolves.toBe(true);
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

			const params = [
				{
					assetId: "nep141:btc.omft.near",
					destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				},
				{ assetId: "nep141:wrap.near", destinationAddress: zeroAddress },
				{
					assetId: "nep141:token.publicailab.near",
					destinationAddress: zeroAddress,
				},
				{ assetId: "nep141:token.sweat", destinationAddress: zeroAddress },
				{
					assetId: "nep245:v3_1.omni.hot.tg:56_11111111111111111111",
					destinationAddress: zeroAddress,
				},
				{
					assetId:
						"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
					destinationAddress: zeroAddress,
				},
			];

			for (const param of params) {
				await expect(bridge.supports(param)).resolves.toBe(false);
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

				await expect(
					bridge.supports({
						assetId,
						routeConfig,
						destinationAddress: "HuTshmtwcQkWBLzgW3m4uwcmik7Lmz4YFpYcTqMJpXiP",
					}),
				).resolves.toBe(true);
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

				await expect(
					bridge.supports({
						assetId,
						routeConfig,
						destinationAddress: zeroAddress,
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
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

				await expect(
					bridge.supports({
						assetId,
						routeConfig,
						destinationAddress: zeroAddress,
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			});

			it.each([
				{
					assetId: "nep141:token.publicailab.near",
					routeConfig: createOmniBridgeRoute(Chains.Dogecoin),
					destinationAddress: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
				},
				{
					assetId: "nep141:nbtc.bridge.near",
					routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
					destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				},
			])(
				"throws UnsupportedAssetIdError if trying to bridge a token to unsupported chain",
				async ({ assetId, routeConfig, destinationAddress }) => {
					const nearProvider = nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					});

					const bridge = new OmniBridge({
						env: "production",
						nearProvider,
					});

					await expect(
						bridge.supports({ assetId, routeConfig, destinationAddress }),
					).rejects.toThrow(UnsupportedAssetIdError);
				},
			);

			it.each([
				{
					assetId: "nep141:btc.omft.near",
					routeConfig: createOmniBridgeRoute(Chains.Solana),
					destinationAddress: "HuTshmtwcQkWBLzgW3m4uwcmik7Lmz4YFpYcTqMJpXiP",
				},
			])(
				"throws TokenNotFoundInDestinationChainError if routeConfig passed, but assetId is not found in destination chain token",
				async ({ assetId, routeConfig, destinationAddress }) => {
					const nearProvider = nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					});

					const bridge = new OmniBridge({
						env: "production",
						nearProvider,
					});

					await expect(
						bridge.supports({ assetId, routeConfig, destinationAddress }),
					).rejects.toThrow(TokenNotFoundInDestinationChainError);
				},
			);
		});
	});
});

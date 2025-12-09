import { describe, expect, it, vi } from "vitest";
import { HotBridge } from "./hot-bridge";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { HotBridge as HotOmniSdk } from "@hot-labs/omni-sdk";
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
import type { IntentPrimitive } from "../../intents/shared-types";
import { RouteEnum } from "../../constants/route-enum";
import type { FeeEstimation } from "../../shared-types";

describe("HotBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
			// todo: add more test cases for each supported chain
		])("supports `v2_1.omni.hot.tg` tokens", async (tokenId) => {
			const bridge = new HotBridge({
				env: "production",
				hotSdk: new HotOmniSdk({
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
				hotSdk: new HotOmniSdk({
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
					hotSdk: new HotOmniSdk({
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
					hotSdk: new HotOmniSdk({
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
				hotSdk: new HotOmniSdk({
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
					hotSdk: {} as unknown as HotOmniSdk,
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

	describe("waitForWithdrawalCompletion()", () => {
		it("uses chain-aware retry options based on routeConfig.chain", async () => {
			vi.useFakeTimers();

			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				env: "production",
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			const getGaslessWithdrawStatus = vi
				.spyOn(hotSDK, "getGaslessWithdrawStatus")
				.mockRejectedValue(new Error("pending"));

			// Ethereum has p99=43s, timeout=64.5s -> ~24 attempts with delay=2000, factor=1.3
			const ethereumPromise = bridge
				.waitForWithdrawalCompletion({
					tx: { hash: "", accountId: "" },
					index: 0,
					routeConfig: createHotBridgeRoute(Chains.Ethereum),
				})
				.catch((err: unknown) => err);

			await vi.runAllTimersAsync();
			await ethereumPromise;

			expect(getGaslessWithdrawStatus.mock.calls.length).toBe(24);

			vi.useRealTimers();
		});

		it("respects custom retry options override", async () => {
			vi.useFakeTimers();

			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				env: "production",
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			const getGaslessWithdrawStatus = vi
				.spyOn(hotSDK, "getGaslessWithdrawStatus")
				.mockRejectedValue(new Error("pending"));

			const promise = bridge
				.waitForWithdrawalCompletion({
					tx: { hash: "", accountId: "" },
					index: 0,
					routeConfig: createHotBridgeRoute(Chains.Ethereum),
					retryOptions: { delay: 100, factor: 1, maxAttempts: 3 },
				})
				.catch((err: unknown) => err);

			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result).toBeInstanceOf(Error);
			expect(getGaslessWithdrawStatus.mock.calls.length).toBe(3);

			vi.useRealTimers();
		});

		it("returns destination tx hash", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				env: "production",
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				"DEADBEEF",
			);

			const result = bridge.waitForWithdrawalCompletion({
				tx: { hash: "", accountId: "" },
				index: 0,
				routeConfig: createHotBridgeRoute(Chains.TON),
			});

			await expect(result).resolves.toEqual({ hash: "DEADBEEF" });
		});

		it("returns no tx if destination tx hash is not valid", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				env: "production",
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				"invalid_tx_hash",
			);

			const mockLogger = {
				error() {},
				warn: vi.fn(),
				info() {},
				debug() {},
				trace() {},
			};

			const result = bridge.waitForWithdrawalCompletion({
				tx: { hash: "", accountId: "" },
				index: 0,
				routeConfig: createHotBridgeRoute(Chains.TON),
				logger: mockLogger,
			});

			await expect(result).resolves.toEqual({ hash: null });
			expect(mockLogger.warn).toHaveBeenCalledWith(
				"HOT Bridge incorrect destination tx hash detected",
				{ value: "invalid_tx_hash" },
			);
		});
	});

	describe("estimateWithdrawalFee()", () => {
		it("uses Monad mainnet network id", async () => {
			const getGaslessWithdrawFee = vi
				.fn()
				.mockResolvedValue({ gasPrice: 10n, blockNumber: 12345n });

			const hotSdk = {
				getGaslessWithdrawFee,
			} as unknown as HotOmniSdk;

			const bridge = new HotBridge({
				env: "production",
				hotSdk,
			});

			const assetId = "nep245:v2_1.omni.hot.tg:143_11111111111111111111";
			const feeEstimation = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId,
					destinationAddress: zeroAddress,
				},
			});

			expect(getGaslessWithdrawFee).toHaveBeenCalledWith(
				expect.objectContaining({ chain: 143, token: "native" }),
			);
			expect(feeEstimation).toEqual({
				amount: 10n,
				quote: null,
				underlyingFees: {
					[RouteEnum.HotBridge]: {
						relayerFee: 10n,
						blockNumber: 12345n,
					},
				},
			});
		});
	});

	describe("createWithdrawalIntents()", () => {
		it("uses Monad mainnet network id", async () => {
			const mockIntent = {
				intent: "mt_withdraw",
				token: "foo.near",
				token_ids: ["nep245:v2_1.omni.hot.tg:143_11111111111111111111"],
				amounts: ["110"],
				receiver_id: zeroAddress,
			} satisfies Extract<IntentPrimitive, { intent: "mt_withdraw" }>;
			const buildGaslessWithdrawIntent = vi.fn().mockResolvedValue(mockIntent);

			const hotSdk = {
				buildGaslessWithdrawIntent,
			} as unknown as HotOmniSdk;

			const bridge = new HotBridge({
				env: "production",
				hotSdk,
			});

			const feeEstimation: FeeEstimation = {
				amount: 10n,
				quote: null,
				underlyingFees: {
					[RouteEnum.HotBridge]: {
						relayerFee: 10n,
						blockNumber: 0n,
					},
				},
			};
			const withdrawalParams = {
				assetId: "nep245:v2_1.omni.hot.tg:143_11111111111111111111",
				amount: 100n,
				destinationAddress: zeroAddress,
				feeInclusive: true,
				routeConfig: createHotBridgeRoute(Chains.Monad),
			};

			const intents = await bridge.createWithdrawalIntents({
				withdrawalParams,
				feeEstimation,
			});

			expect(buildGaslessWithdrawIntent).toHaveBeenCalledWith(
				expect.objectContaining({ chain: 143 }),
			);
			expect(intents).toEqual([mockIntent]);
		});
	});
});

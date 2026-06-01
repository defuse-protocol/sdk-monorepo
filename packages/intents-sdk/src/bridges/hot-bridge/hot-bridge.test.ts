import {
	bridgeIndexer,
	configsByEnvironment,
} from "@defuse-protocol/internal-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HotBridge } from "./hot-bridge";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { HotBridge as HotOmniSdk } from "@hot-labs/omni-sdk";
import {
	createHotBridgeRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
import { HotWithdrawStatus } from "./hot-bridge-constants";
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

vi.mock("@defuse-protocol/internal-utils", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@defuse-protocol/internal-utils")>();

	return {
		...actual,
		bridgeIndexer: {
			...actual.bridgeIndexer,
			httpClient: {
				...actual.bridgeIndexer.httpClient,
				withdrawalsByNearTxHash: vi.fn(),
			},
		},
	};
});

type BridgeIndexerResponse = Awaited<
	ReturnType<typeof bridgeIndexer.httpClient.withdrawalsByNearTxHash>
>;

const TON_USDT_ASSET_ID =
	"nep245:v2_1.omni.hot.tg:1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR";
const BNB_NATIVE_ASSET_ID = "nep245:v2_1.omni.hot.tg:56_11111111111111111111";
const TON_DESTINATION_ADDRESS =
	"UQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI";

function bridgeIndexerResponse(
	withdrawals: BridgeIndexerResponse["withdrawals"],
): BridgeIndexerResponse {
	return {
		near_trx: "near-tx-hash",
		withdrawals,
	};
}

function bridgeIndexerWithdrawal({
	hash,
	nonce = "1",
}: {
	hash: string | null;
	nonce?: string;
}): BridgeIndexerResponse["withdrawals"][number] {
	return {
		hash,
		nonce,
		chain_id: 1117,
		withdraw_asset: null,
		withdraw_token: null,
		withdraw_amount: null,
		receiver_address: TON_DESTINATION_ADDRESS,
		signature: null,
		near_tx_time: null,
		near_tx_block: null,
		destination_chain_block: null,
	};
}

function mockBridgeIndexerWithdrawals(
	withdrawals: BridgeIndexerResponse["withdrawals"],
): void {
	vi.mocked(bridgeIndexer.httpClient.withdrawalsByNearTxHash).mockResolvedValue(
		bridgeIndexerResponse(withdrawals),
	);
}

function mockBridgeIndexerFailure(): void {
	vi.mocked(bridgeIndexer.httpClient.withdrawalsByNearTxHash).mockRejectedValue(
		new Error("Bridge indexer error"),
	);
}

describe("HotBridge", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.mocked(bridgeIndexer.httpClient.withdrawalsByNearTxHash).mockReset();
	});

	describe("supports()", () => {
		it.each([
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
			// todo: add more test cases for each supported chain
		])("supports `v2_1.omni.hot.tg` tokens", async (tokenId) => {
			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
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
				envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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

		it("returns false when routeConfig is for different bridge", async () => {
			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: new HotOmniSdk({
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			});

			const result = await bridge.supports({
				assetId: "nep245:v2_1.omni.hot.tg:56_11111111111111111111",
				routeConfig: createPoaBridgeRoute(),
			});

			expect(result).toBe(false);
		});
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
				destinationAddress: "EQAs9VlT6S776tq3unJcP5Ogsj-ELLunLXuOb1EKcOQi4wJB",
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
				envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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

	describe("createWithdrawalIdentifier()", () => {
		it("derives landing chain from asset", () => {
			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: {} as unknown as HotOmniSdk,
			});

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR",
					amount: 100n,
					destinationAddress:
						"UQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI",
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "tx-hash", accountId: "test.near" },
			});

			expect(wid.landingChain).toBe(Chains.TON);
			expect(wid.index).toBe(0);
		});
	});

	describe("describeWithdrawal()", () => {
		it("returns completed TON status with bridge indexer hash", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			const hotTraceRootHash =
				"4a810b9459ce2e73d74b497598744e3cb54f50715f90ef07a66397468a60b121";
			const receiverJettonWalletHash =
				"2dbebb2ab0d2ad52ed026fc23e3a23c92e1ca23ae5355a4f99dc8f2fc97ff1c1";
			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				hotTraceRootHash,
			);
			mockBridgeIndexerWithdrawals([
				bridgeIndexerWithdrawal({ hash: receiverJettonWalletHash }),
			]);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: TON_USDT_ASSET_ID,
					amount: 100n,
					destinationAddress: TON_DESTINATION_ADDRESS,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({
				status: "completed",
				txHash: receiverJettonWalletHash,
			});
		});

		it("keeps TON withdrawal pending while bridge indexer has no hash", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				"4a810b9459ce2e73d74b497598744e3cb54f50715f90ef07a66397468a60b121",
			);
			mockBridgeIndexerWithdrawals([]);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: TON_USDT_ASSET_ID,
					amount: 100n,
					destinationAddress: TON_DESTINATION_ADDRESS,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("keeps TON withdrawal pending when bridge indexer request fails", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(null);
			mockBridgeIndexerFailure();
			const requestApiSpy = vi
				.spyOn(hotSDK.api, "requestApi")
				.mockResolvedValue(
					new Response(
						JSON.stringify({
							hash: "4a810b9459ce2e73d74b497598744e3cb54f50715f90ef07a66397468a60b121",
							nonce: "1",
							near_trx: "near-tx-hash",
							withdrawals: [
								{
									hash: "4a810b9459ce2e73d74b497598744e3cb54f50715f90ef07a66397468a60b121",
									nonce: "1",
									near_trx: "near-tx-hash",
									verified_withdraw: true,
									chain_id: 1117,
								},
							],
						}),
					),
				);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: TON_USDT_ASSET_ID,
					amount: 100n,
					destinationAddress: TON_DESTINATION_ADDRESS,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
			expect(requestApiSpy).not.toHaveBeenCalled();
		});

		it("keeps TON withdrawal pending when bridge indexer has no hash and HOT status hash is invalid", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				"invalid_tx_hash",
			);
			mockBridgeIndexerWithdrawals([]);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep245:v2_1.omni.hot.tg:1117_",
					amount: 100n,
					destinationAddress:
						"UQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI",
					feeInclusive: false,
					routeConfig: createHotBridgeRoute(Chains.TON),
				},
				index: 0,
				tx: { hash: "", accountId: "" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("returns failed status when withdrawal is canceled", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				HotWithdrawStatus.Canceled,
			);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep245:v2_1.omni.hot.tg:1117_",
					amount: 100n,
					destinationAddress: TON_DESTINATION_ADDRESS,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "", accountId: "" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({
				status: "failed",
				reason: "Withdrawal was cancelled",
			});
		});

		it("keeps TON withdrawal pending when bridge indexer has no hash and HOT status is completed", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				HotWithdrawStatus.Completed,
			);
			mockBridgeIndexerWithdrawals([]);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep245:v2_1.omni.hot.tg:1117_",
					amount: 100n,
					destinationAddress: TON_DESTINATION_ADDRESS,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "", accountId: "" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("returns pending status when contract returns null and API has no hash", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(null);
			mockBridgeIndexerFailure();
			vi.spyOn(hotSDK.api, "requestApi").mockResolvedValue(
				new Response(
					JSON.stringify({
						hash: null,
						nonce: "1",
						near_trx: "txhash",
						withdrawals: [],
					}),
				),
			);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: BNB_NATIVE_ASSET_ID,
					amount: 100n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "txhash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("returns completed via API fallback when contract returns null but API has hash", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(null);
			mockBridgeIndexerFailure();
			vi.spyOn(hotSDK.api, "requestApi").mockResolvedValue(
				new Response(
					JSON.stringify({
						hash: "0xDEADBEEF",
						nonce: "1",
						near_trx: "txhash",
						withdrawals: [
							{
								hash: "0xDEADBEEF",
								nonce: "1",
								near_trx: "txhash",
								verified_withdraw: true,
								chain_id: 56,
							},
						],
					}),
				),
			);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: BNB_NATIVE_ASSET_ID,
					amount: 100n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "txhash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "completed", txHash: "0xDEADBEEF" });
		});

		it("returns pending when API request fails", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(null);
			mockBridgeIndexerFailure();
			vi.spyOn(hotSDK.api, "requestApi").mockRejectedValue(
				new Error("Network error"),
			);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: BNB_NATIVE_ASSET_ID,
					amount: 100n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "txhash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("ignores API response with invalid hash format", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			vi.spyOn(hotSDK.near, "parseWithdrawalNonces").mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(null);
			mockBridgeIndexerFailure();
			vi.spyOn(hotSDK.api, "requestApi").mockResolvedValue(
				new Response(
					JSON.stringify({
						hash: "not_a_hex_hash",
						nonce: "1",
						near_trx: "txhash",
						withdrawals: [
							{
								hash: "not_a_hex_hash",
								nonce: "1",
								near_trx: "txhash",
								verified_withdraw: true,
								chain_id: 56,
							},
						],
					}),
				),
			);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: BNB_NATIVE_ASSET_ID,
					amount: 100n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "txhash", accountId: "test.near" },
			});

			const result = await bridge.describeWithdrawal(wid);

			expect(result).toEqual({ status: "pending" });
		});

		it("caches nonces and calls parseWithdrawalNonces only once per tx", async () => {
			const hotSDK = new HotOmniSdk({
				logger: console,
				evmRpc: {},
				nearRpc: [],
				async executeNearTransaction() {
					throw new Error("not implemented");
				},
			});

			const bridge = new HotBridge({
				envConfig: configsByEnvironment.production,
				hotSdk: hotSDK,
			});

			const parseNoncesSpy = vi
				.spyOn(hotSDK.near, "parseWithdrawalNonces")
				.mockResolvedValue([1n]);
			vi.spyOn(hotSDK, "getGaslessWithdrawStatus").mockResolvedValue(
				"DEADBEEF",
			);
			mockBridgeIndexerWithdrawals([
				bridgeIndexerWithdrawal({ hash: "DEADBEEF" }),
			]);

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep245:v2_1.omni.hot.tg:1117_",
					amount: 100n,
					destinationAddress:
						"UQDrjaLahLkMB-hMCmkzOyBuHJ139ZUYmPHu6RRBKnbdLIYI",
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "same-tx-hash", accountId: "same.near" },
			});

			// Call describeWithdrawal multiple times with same tx
			await bridge.describeWithdrawal(wid);
			await bridge.describeWithdrawal(wid);
			await bridge.describeWithdrawal(wid);

			// parseWithdrawalNonces should only be called once due to caching
			expect(parseNoncesSpy).toHaveBeenCalledTimes(1);
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
				envConfig: configsByEnvironment.production,
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
				envConfig: configsByEnvironment.production,
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

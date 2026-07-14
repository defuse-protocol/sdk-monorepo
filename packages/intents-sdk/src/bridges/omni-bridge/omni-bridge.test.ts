import {
	configsByEnvironment,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { BridgeAPI } from "@omni-bridge/core";
import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as omniBridgeUtils from "./omni-bridge-utils";
import * as estimateFee from "../../lib/estimate-fee";
import {
	InvalidDestinationAddressForWithdrawalError,
	MinWithdrawalAmountError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import { Chains } from "../../lib/caip2";
import {
	createOmniBridgeRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
import {
	IntentsNearOmniAvailableBalanceTooLowError,
	TokenNotFoundInDestinationChainError,
} from "./error";
import {
	INTENTS_STORAGE_BALANCE_CACHE_KEY,
	MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR,
} from "./omni-bridge-constants";
import { OmniBridge } from "./omni-bridge";

describe("OmniBridge", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("without routeConfig", () => {
		it("supports if assetId matches omni pattern (token created by specific factories)", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const assetIds = [
				"nep141:eth.bridge.near",
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
				envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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
						envConfig: configsByEnvironment.production,
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
						envConfig: configsByEnvironment.production,
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
					envConfig: configsByEnvironment.production,
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
							underlyingFees: {
								[RouteEnum.OmniBridge]: {
									relayerFee: 25_000_000_000n,
									storageDepositFee: 0n,
								},
							},
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
					envConfig: configsByEnvironment.production,
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
							underlyingFees: {
								[RouteEnum.OmniBridge]: {
									relayerFee: 25_000_000_000n,
									storageDepositFee: 0n,
								},
							},
						},
						routeConfig,
					}),
				).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
			},
		);
	});

	describe("createWithdrawalIdentifier()", () => {
		it("derives landing chain from asset when routeConfig not provided", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "tx-hash", accountId: "test.near" },
			});

			expect(wid.landingChain).toBe(Chains.Ethereum);
			expect(wid.index).toBe(0);
		});

		it("uses chain from routeConfig when provided", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
					routeConfig: createOmniBridgeRoute(Chains.Base),
				},
				index: 2,
				tx: { hash: "tx-hash", accountId: "test.near" },
			});

			expect(wid.landingChain).toBe(Chains.Base);
			expect(wid.index).toBe(2);
		});
	});

	describe("describeWithdrawal()", () => {
		function createTransferMock(
			overrides: Partial<Awaited<ReturnType<BridgeAPI["getTransfer"]>>[0]>,
		): Awaited<ReturnType<BridgeAPI["getTransfer"]>>[0] {
			return {
				transfer_id: null,
				source_chain: null,
				destination_chain: null,
				sender: null,
				recipient: null,
				token_id: null,
				amount: null,
				fee: null,
				native_fee: null,
				msg: null,
				destination_nonce: null,
				status: "Initialised",
				initialised: null,
				signed: [],
				fast_finalised_on_near: null,
				finalised_on_near: null,
				fast_finalised: null,
				finalised: null,
				claimed: null,
				verified: null,
				fee_updates: [],
				utxo_signs: [],
				utxo_winning_tx_hash: null,
				utxo_meta: null,
				tx_ids: [],
				...overrides,
			};
		}

		it("returns completed status with EVM tx hash", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "eth:0x1234567890123456789012345678901234567890",
					finalised: {
						transaction_hash: "0xevm-tx-hash",
						chain: "Eth",
						timestamp_seconds: 1700000000,
						details: {
							type: "evm",
							block_number: 1,
							transaction_index: null,
							log_index: null,
						},
					},
				}),
			]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Ethereum,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "0xevm-tx-hash",
			});
		});

		it("returns completed status with Solana signature", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "sol:9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
					finalised: {
						transaction_hash: "solana-signature",
						chain: "Sol",
						timestamp_seconds: 1700000000,
						details: { type: "solana", slot: 1, instruction_index: 0 },
					},
				}),
			]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Solana,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:sol.omft.near",
					amount: 100000n,
					destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "solana-signature",
			});
		});

		it("returns pending status when transfer not found", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Ethereum,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });
		});

		it("returns pending status when tx hash not yet available", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "eth:0x1234567890123456789012345678901234567890",
					finalised: null,
				}),
			]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Ethereum,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });
		});

		it("returns correct transfer by index", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "eth:0x1111111111111111111111111111111111111111",
					finalised: {
						transaction_hash: "0xfirst-tx",
						chain: "Eth",
						timestamp_seconds: 1700000000,
						details: {
							type: "evm",
							block_number: 1,
							transaction_index: null,
							log_index: null,
						},
					},
				}),
				createTransferMock({
					recipient: "eth:0x2222222222222222222222222222222222222222",
					finalised: {
						transaction_hash: "0xsecond-tx",
						chain: "Eth",
						timestamp_seconds: 1700000001,
						details: {
							type: "evm",
							block_number: 2,
							transaction_index: null,
							log_index: null,
						},
					},
				}),
			]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Ethereum,
				index: 1,
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "0xsecond-tx",
			});
		});

		it("returns completed status with BTC pending tx hash in browser environment", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "btc:bc1qtest",
					utxo_winning_tx_hash: "btc-pending-tx-hash",
					finalised: {
						transaction_hash: "btc-final-tx-hash",
						chain: "Btc",
						timestamp_seconds: 1700000000,
						details: { type: "utxo", block_height: 0, block_hash: "hash" },
					},
				}),
			]);

			// Simulate browser environment
			vi.stubGlobal("window", {});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:nbtc.bridge.near",
					amount: 100000n,
					destinationAddress: "bc1qtest",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "btc-pending-tx-hash",
			});

			vi.unstubAllGlobals();
		});

		it("returns completed status with BTC final tx hash in server environment", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "btc:bc1qtest",
					utxo_winning_tx_hash: "btc-pending-tx-hash",
					finalised: {
						transaction_hash: "btc-final-tx-hash",
						chain: "Btc",
						timestamp_seconds: 1700000000,
						details: { type: "utxo", block_height: 0, block_hash: "hash" },
					},
				}),
			]);

			// Ensure no window (server environment)
			vi.stubGlobal("window", undefined);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:nbtc.bridge.near",
					amount: 100000n,
					destinationAddress: "bc1qtest",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "btc-final-tx-hash",
			});

			vi.unstubAllGlobals();
		});

		it("returns pending when BTC utxo_winning_tx_hash has no pending id", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: "btc:bc1qtest",
					utxo_winning_tx_hash: null,
					finalised: null,
				}),
			]);

			vi.stubGlobal("window", {});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:nbtc.bridge.near",
					amount: 100000n,
					destinationAddress: "bc1qtest",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });

			vi.unstubAllGlobals();
		});

		it("returns pending when recipient is null", async () => {
			vi.spyOn(BridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					recipient: null,
				}),
			]);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Ethereum,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:eth.bridge.near",
					amount: 100000n,
					destinationAddress: zeroAddress,
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });
		});
	});

	describe("parseAssetId()", () => {
		it("returns parsed info for omni bridge token", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.parseAssetId("nep141:eth.bridge.near");

			expect(result).toMatchObject({
				standard: "nep141",
				contractId: "eth.bridge.near",
				blockchain: Chains.Ethereum,
			});
		});

		it("returns null for non-nep141 standard", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.parseAssetId(
				"nep245:v3_1.omni.hot.tg:56_11111111111111111111",
			);

			expect(result).toBeNull();
		});

		it("returns null for token without omni origin chain", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.parseAssetId("nep141:wrap.near");

			expect(result).toBeNull();
		});
	});

	describe("supports() edge cases", () => {
		it("returns false when routeConfig is for different bridge", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.supports({
				assetId: "nep141:eth.bridge.near",
				routeConfig: createPoaBridgeRoute(),
			});

			expect(result).toBe(false);
		});

		it("throws when target chain specified with non-nep141 asset", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.supports({
					assetId: "nep245:v3_1.omni.hot.tg:56_11111111111111111111",
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).rejects.toThrow(UnsupportedAssetIdError);
		});

		it("allows PoA token when routeConfig and target Chain set", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			});
			expect(result).toBe(true);
		});

		it("blocks PoA token without routeConfig and target Chain set", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
			});
			expect(result).toBe(false);
		});

		it("throws when PoA token with routeConfig set to Omni Bridge but no target Chain set", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.supports({
					assetId:
						"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
					routeConfig: createOmniBridgeRoute(),
				}),
			).rejects.toThrow(UnsupportedAssetIdError);
		});

		it("does not support PoA token routable through Omni with no routeConfig when routeMigratedPoaTokensThroughOmniBridge = false", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
			});

			expect(result).toBe(false);
		});
		it("Throws when given a PoA token that can be routed through Omni with route config without a target chain when routeMigratedPoaTokensThroughOmniBridge = false", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.supports({
					assetId:
						"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
					routeConfig: createOmniBridgeRoute(),
				}),
			).rejects.toThrow(UnsupportedAssetIdError);
		});

		it("supports PoA token with routeConfig and valid target chain when routeMigratedPoaTokensThroughOmniBridge = false", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			});
			expect(result).toBe(true);
		});

		it("throws for PoA token with routeConfig and invalid target chain when routeMigratedPoaTokensThroughOmniBridge = false", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.supports({
					assetId:
						"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).rejects.toThrow(TokenNotFoundInDestinationChainError);
		});

		it("allows routable PoA token with no routeConfig when routeMigratedPoaTokensThroughOmniBridge = true", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				routeMigratedPoaTokensThroughOmniBridge: true,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
			});
			expect(result).toBe(true);
		});

		it("allows routable PoA token with routeConfig but no target chain when routeMigratedPoaTokensThroughOmniBridge = true", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				routeMigratedPoaTokensThroughOmniBridge: true,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
				routeConfig: createOmniBridgeRoute(),
			});
			expect(result).toBe(true);
		});

		it("allows routable PoA token with routeConfig and target chain when routeMigratedPoaTokensThroughOmniBridge = true", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				routeMigratedPoaTokensThroughOmniBridge: true,
			});

			const result = await bridge.supports({
				assetId:
					"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			});
			expect(result).toBe(true);
		});

		it("throws for routable PoA token with routeConfig and invalid target chain when routeMigratedPoaTokensThroughOmniBridge = true", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				routeMigratedPoaTokensThroughOmniBridge: true,
			});

			await expect(
				bridge.supports({
					assetId:
						"nep141:sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near",
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).rejects.toThrow(TokenNotFoundInDestinationChainError);
		});
	});

	describe("makeAssetInfo()", () => {
		it("returns info with routeConfig chain when specified", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.makeAssetInfo(
				"nep141:wrap.near",
				createOmniBridgeRoute(Chains.Base),
			);

			expect(result).toMatchObject({
				standard: "nep141",
				contractId: "wrap.near",
				blockchain: Chains.Base,
				bridgeName: BridgeNameEnum.Omni,
			});
		});

		it("returns null for non-nep141 standard", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.makeAssetInfo(
				"nep245:v3_1.omni.hot.tg:56_11111111111111111111",
			);

			expect(result).toBeNull();
		});

		it("returns null when origin chain cannot be parsed", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.makeAssetInfo("nep141:wrap.near");

			expect(result).toBeNull();
		});

		it("derives blockchain from token origin when no routeConfig", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.makeAssetInfo("nep141:eth.bridge.near");

			expect(result).toMatchObject({
				blockchain: Chains.Ethereum,
				bridgeName: BridgeNameEnum.Omni,
			});
		});
	});

	describe("targetChainSpecified()", () => {
		it("returns true when routeConfig has chain", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.targetChainSpecified(
				createOmniBridgeRoute(Chains.Ethereum),
			);

			expect(result).toBe(true);
		});

		it("returns false when routeConfig has no chain", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.targetChainSpecified(createOmniBridgeRoute());

			expect(result).toBe(false);
		});

		it("returns false when routeConfig is undefined", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.targetChainSpecified(undefined);

			expect(result).toBe(false);
		});

		it("returns false when routeConfig is for different bridge", () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.targetChainSpecified(createPoaBridgeRoute());

			expect(result).toBe(false);
		});
	});

	describe("getCachedIntentsStorageBalance()", () => {
		it("cache balance when it is above MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR", async () => {
			const lowBalance = MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR + 1n;
			const lowBalanceString = lowBalance.toString();

			vi.spyOn(
				omniBridgeUtils,
				"getAccountOmniStorageBalance",
			).mockResolvedValue({
				total: lowBalanceString,
				available: lowBalanceString,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			// biome-ignore lint/complexity/useLiteralKeys: accessing private method for testing
			await bridge["getCachedIntentsStorageBalance"]();

			expect(
				// biome-ignore lint/complexity/useLiteralKeys: accessing protected property for testing
				bridge["intentsStorageBalanceCache"].get(
					INTENTS_STORAGE_BALANCE_CACHE_KEY,
				),
			).toBe(lowBalance);
		});

		it("does not cache balance when it is below MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR", async () => {
			const lowBalance = (MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR - 1n).toString();

			vi.spyOn(
				omniBridgeUtils,
				"getAccountOmniStorageBalance",
			).mockResolvedValue({
				total: lowBalance,
				available: lowBalance,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			// biome-ignore lint/complexity/useLiteralKeys: accessing private method for testing
			await bridge["getCachedIntentsStorageBalance"]();

			// biome-ignore lint/complexity/useLiteralKeys: accessing protected property for testing
			expect(bridge["intentsStorageBalanceCache"].size).toBe(0);
		});
	});

	describe("validateWithdrawal()", () => {
		it("throws IntentsNearOmniAvailableBalanceTooLowError when storage balance is too low", async () => {
			const lowBalance = MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR.toString();

			vi.spyOn(
				omniBridgeUtils,
				"getAccountOmniStorageBalance",
			).mockResolvedValue({
				total: lowBalance,
				available: lowBalance,
			});

			vi.spyOn(omniBridgeUtils, "getBridgedToken").mockResolvedValue(
				"eth:0x0000000000000000000000000000000000000000",
			);

			vi.spyOn(omniBridgeUtils, "getTokenDecimals").mockResolvedValue({
				decimals: 18,
				origin_decimals: 18,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:eth.bridge.near",
					amount: 1000000000000000000n,
					destinationAddress: zeroAddress,
					feeEstimation: {
						amount: 25_000_000_000n,
						quote: null,
						underlyingFees: {
							[RouteEnum.OmniBridge]: {
								relayerFee: 25_000_000_000n,
								storageDepositFee: 0n,
							},
						},
					},
				}),
			).rejects.toThrow(IntentsNearOmniAvailableBalanceTooLowError);
		});

		it("accepts zero fee for subsidized tokens", async () => {
			const highBalance = (
				MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR + 1n
			).toString();

			vi.spyOn(
				omniBridgeUtils,
				"getAccountOmniStorageBalance",
			).mockResolvedValue({
				total: highBalance,
				available: highBalance,
			});

			vi.spyOn(omniBridgeUtils, "getBridgedToken").mockResolvedValue(
				"eth:0x0000000000000000000000000000000000000000",
			);

			vi.spyOn(omniBridgeUtils, "getTokenDecimals").mockResolvedValue({
				decimals: 6,
				origin_decimals: 6,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:lsd-usdt.rhealab.near",
					amount: 1_000_000n,
					destinationAddress: zeroAddress,
					feeEstimation: {
						amount: 0n,
						quote: null,
						underlyingFees: {
							[RouteEnum.OmniBridge]: {
								relayerFee: 0n,
								storageDepositFee: 0n,
							},
						},
					},
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).resolves.toBeUndefined();
		});

		it("Throws MinWithdrawalAmountError when amount fails to pass normalization check ", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			const result = bridge.validateWithdrawal({
				assetId: "nep141:nbtc.bridge.near",
				amount: 0n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				feeEstimation: {
					amount: 5n,
					quote: null,
					underlyingFees: {
						[RouteEnum.OmniBridge]: {
							relayerFee: expect.any(BigInt),
							storageDepositFee: 0n,
						},
					},
				},
			});

			await expect(result).rejects.toThrow(MinWithdrawalAmountError);
		});

		it("Throws MinWithdrawalAmountError when amount fails to pass min withdrawal amount for btc", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			vi.spyOn(BridgeAPI.prototype, "getFee").mockResolvedValue({
				native_token_fee: 0n,
				transferred_token_fee: "0",
				gas_fee: 700n,
				protocol_fee: 400n,
				min_amount: "6400",
				usd_fee: 0.58,
				insufficient_utxo: false, // flag that contains the check for available utxo amount
			});

			const result = bridge.validateWithdrawal({
				assetId: "nep141:nbtc.bridge.near",
				amount: 3000n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				feeEstimation: {
					amount: 1100n,
					quote: null,
					underlyingFees: {
						[RouteEnum.OmniBridge]: {
							utxoMaxGasFee: 700n,
							utxoProtocolFee: 400n,
							relayerFee: expect.any(BigInt),
							storageDepositFee: 0n,
						},
					},
				},
			});

			await expect(result).rejects.toThrow(MinWithdrawalAmountError);
		});

		it("Skips all min amount checks when skipMinAmountValidation is true", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			vi.spyOn(BridgeAPI.prototype, "getFee").mockResolvedValue({
				native_token_fee: 0n,
				transferred_token_fee: "0",
				gas_fee: 700n,
				protocol_fee: 400n,
				min_amount: "6400",
				usd_fee: 0.58,
				insufficient_utxo: false, // flag that contains the check for available utxo amount
			});

			const result = bridge.validateWithdrawal({
				assetId: "nep141:nbtc.bridge.near",
				amount: 0n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				skipMinAmountValidation: true,
				feeEstimation: {
					amount: 1100n,
					quote: null,
					underlyingFees: {
						[RouteEnum.OmniBridge]: {
							utxoMaxGasFee: 700n,
							utxoProtocolFee: 400n,
							relayerFee: expect.any(BigInt),
							storageDepositFee: 0n,
						},
					},
				},
			});

			await expect(result).resolves.toBeUndefined();
		});
	});

	describe("estimateWithdrawalFee()", () => {
		it("returns zero relayer fee for subsidized tokens even when API returns non-zero", async () => {
			vi.spyOn(BridgeAPI.prototype, "getFee").mockResolvedValue({
				native_token_fee: 50_000_000_000n,
				usd_fee: 0.5,
				insufficient_utxo: false,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
			bridge["storageDepositCache"].set("lsd-usdt.rhealab.near", [0n, 0n]);

			const result = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId: "nep141:lsd-usdt.rhealab.near",
					destinationAddress: zeroAddress,
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
					amount: 1_000_000n,
				},
			});

			expect(result.amount).toBe(0n);
			expect(result.quote).toBeNull();

			const omniFees = result.underlyingFees[RouteEnum.OmniBridge];
			expect(omniFees?.relayerFee).toBe(0n);
		});
	});

	describe("prefundedNativeFeeTokens", () => {
		// Non-subsidized Omni token; fee bypass must come from the prefunded config, not FEE_SUBSIDIZED_TOKENS.
		const prefundedAssetId = "nep141:eth.bridge.near";

		it("estimateWithdrawalFee skips the fee quote for a prefunded token while keeping the relayer fee", async () => {
			vi.spyOn(BridgeAPI.prototype, "getFee").mockResolvedValue({
				native_token_fee: 50_000_000_000n,
				usd_fee: 0.5,
				insufficient_utxo: false,
			});
			const getFeeQuoteSpy = vi
				.spyOn(estimateFee, "getFeeQuote")
				.mockRejectedValue(
					new Error("getFeeQuote must not be called for prefunded tokens"),
				);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				bridgeConfig: { prefundedNativeFeeTokens: [prefundedAssetId] },
			});

			// Pre-seed storage deposit cache so estimation does not hit the network.
			// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
			bridge["storageDepositCache"].set("eth.bridge.near", [0n, 0n]);

			const result = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId: prefundedAssetId,
					destinationAddress: zeroAddress,
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
					amount: 1_000_000n,
				},
			});

			expect(getFeeQuoteSpy).not.toHaveBeenCalled();
			expect(result.amount).toBe(0n);
			expect(result.quote).toBeNull();
			expect(result.underlyingFees[RouteEnum.OmniBridge]?.relayerFee).toBe(
				50_000_000_000n,
			);
		});

		it("estimateWithdrawalFee skips the fee quote for a prefunded token while keeping the relayer fee and storage deposit fee", async () => {
			vi.spyOn(BridgeAPI.prototype, "getFee").mockResolvedValue({
				native_token_fee: 50_000_000_000n,
				usd_fee: 0.5,
				insufficient_utxo: false,
			});
			const getFeeQuoteSpy = vi
				.spyOn(estimateFee, "getFeeQuote")
				.mockRejectedValue(
					new Error("getFeeQuote must not be called for prefunded tokens"),
				);

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				bridgeConfig: { prefundedNativeFeeTokens: [prefundedAssetId] },
			});

			const minStoragedDeposit = 1n;
			const currentStorageBalance = 0n;
			const storageBalanceToPay = minStoragedDeposit - currentStorageBalance;
			// Pre-seed storage deposit cache so estimation does not hit the network.
			// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
			bridge["storageDepositCache"].set("eth.bridge.near", [
				minStoragedDeposit,
				currentStorageBalance,
			]);

			const result = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId: prefundedAssetId,
					destinationAddress: zeroAddress,
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
					amount: 1_000_000n,
				},
			});

			expect(getFeeQuoteSpy).not.toHaveBeenCalled();
			expect(result.amount).toBe(0n);
			expect(result.quote).toBeNull();
			expect(result.underlyingFees[RouteEnum.OmniBridge]?.relayerFee).toBe(
				50_000_000_000n,
			);
			expect(
				result.underlyingFees[RouteEnum.OmniBridge]?.storageDepositFee,
			).toBe(storageBalanceToPay);
		});

		it("validateWithdrawal accepts a zero fee amount for a prefunded token", async () => {
			const highBalance = (
				MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR + 1n
			).toString();

			vi.spyOn(
				omniBridgeUtils,
				"getAccountOmniStorageBalance",
			).mockResolvedValue({ total: highBalance, available: highBalance });
			vi.spyOn(omniBridgeUtils, "getBridgedToken").mockResolvedValue(
				"eth:0x0000000000000000000000000000000000000000",
			);
			vi.spyOn(omniBridgeUtils, "getTokenDecimals").mockResolvedValue({
				decimals: 6,
				origin_decimals: 6,
			});

			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
				bridgeConfig: { prefundedNativeFeeTokens: [prefundedAssetId] },
			});

			await expect(
				bridge.validateWithdrawal({
					assetId: prefundedAssetId,
					amount: 1_000_000n,
					destinationAddress: zeroAddress,
					feeEstimation: {
						// Prefunded: estimation returns a zero amount but a non-zero relayer fee.
						amount: 0n,
						quote: null,
						underlyingFees: {
							[RouteEnum.OmniBridge]: {
								relayerFee: 50_000_000_000n,
								storageDepositFee: 0n,
							},
						},
					},
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).resolves.toBeUndefined();
		});

		it("validateWithdrawal rejects a zero fee amount for a token that is not prefunded", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const bridge = new OmniBridge({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			await expect(
				bridge.validateWithdrawal({
					assetId: prefundedAssetId,
					amount: 1_000_000n,
					destinationAddress: zeroAddress,
					feeEstimation: {
						amount: 0n,
						quote: null,
						underlyingFees: {
							[RouteEnum.OmniBridge]: {
								relayerFee: 0n,
								storageDepositFee: 0n,
							},
						},
					},
					routeConfig: createOmniBridgeRoute(Chains.Ethereum),
				}),
			).rejects.toThrow("Invalid Omni Bridge fee: expected > 0");
		});
	});
});

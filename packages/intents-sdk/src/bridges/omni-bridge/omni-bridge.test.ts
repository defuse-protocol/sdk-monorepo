import {
	configsByEnvironment,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { OmniBridgeAPI } from "omni-bridge-sdk";
import { zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import { Chains } from "../../lib/caip2";
import {
	createOmniBridgeRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
import { TokenNotFoundInDestinationChainError } from "./error";
import { OmniBridge } from "./omni-bridge";

describe("OmniBridge", () => {
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
			overrides: Partial<Awaited<ReturnType<OmniBridgeAPI["getTransfer"]>>[0]>,
		): Awaited<ReturnType<OmniBridgeAPI["getTransfer"]>>[0] {
			return {
				id: null,
				initialized: null,
				signed: null,
				fast_finalised_on_near: null,
				finalised_on_near: null,
				fast_finalised: null,
				finalised: null,
				claimed: null,
				transfer_message: null,
				updated_fee: [],
				utxo_transfer: null,
				...overrides,
			};
		}

		it("returns completed status with EVM tx hash", async () => {
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:eth.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "eth:0x1234567890123456789012345678901234567890",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					finalised: {
						EVMLog: {
							block_height: 1,
							block_timestamp_seconds: 1700000000,
							transaction_hash: "0xevm-tx-hash",
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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:sol.omdep.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "sol:9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					finalised: {
						Solana: {
							slot: 1,
							block_timestamp_seconds: 1700000000,
							signature: "solana-signature",
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
				landingChain: Chains.Solana,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:sol.omdep.near",
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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([]);

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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:eth.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "eth:0x1234567890123456789012345678901234567890",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:eth.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "eth:0x1111111111111111111111111111111111111111",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					finalised: {
						EVMLog: {
							block_height: 1,
							block_timestamp_seconds: 1700000000,
							transaction_hash: "0xfirst-tx",
						},
					},
				}),
				createTransferMock({
					transfer_message: {
						token: "near:eth.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "eth:0x2222222222222222222222222222222222222222",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					finalised: {
						EVMLog: {
							block_height: 2,
							block_timestamp_seconds: 1700000001,
							transaction_hash: "0xsecond-tx",
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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:nbtc.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "btc:bc1qtest",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					utxo_transfer: {
						chain: "",
						amount: "",
						recipient: "",
						relayer_fee: "",
						protocol_fee: "",
						relayer_account_id: "",
						sender: "",
						btc_pending_id: "btc-pending-tx-hash",
					},
					finalised: {
						UtxoLog: {
							transaction_hash: "btc-final-tx-hash",
							block_height: 0,
							block_time: 0,
						},
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
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:nbtc.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "btc:bc1qtest",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					utxo_transfer: {
						chain: "",
						amount: "",
						recipient: "",
						relayer_fee: "",
						protocol_fee: "",
						relayer_account_id: "",
						sender: "",
						btc_pending_id: "btc-pending-tx-hash",
					},
					finalised: {
						UtxoLog: {
							transaction_hash: "btc-final-tx-hash",
							block_height: 0,
							block_time: 0,
						},
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

		it("returns pending when BTC utxo_transfer has no pending id", async () => {
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: {
						token: "near:nbtc.bridge.near",
						amount: "100000",
						sender: "near:test.near",
						recipient: "btc:bc1qtest",
						fee: { fee: "0", native_fee: "0" },
						msg: null,
					},
					utxo_transfer: null,
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

		it("returns pending when transfer_message is null", async () => {
			vi.spyOn(OmniBridgeAPI.prototype, "getTransfer").mockResolvedValue([
				createTransferMock({
					transfer_message: null,
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
				assetId: "nep141:zec.omft.near",
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
				assetId: "nep141:zec.omft.near",
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
					assetId: "nep141:zec.omft.near",
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
});

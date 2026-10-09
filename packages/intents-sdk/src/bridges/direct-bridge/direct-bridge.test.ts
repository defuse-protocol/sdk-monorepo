import { configsByEnvironment } from "@defuse-protocol/internal-utils";
import { describe, expect, it, vi } from "vitest";
import {
	DestinationAddressMatchesTokenAddressError,
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import * as estimateFee from "../../lib/estimate-fee";
import {
	createNearWithdrawalRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
import { RouteEnum } from "../../constants/route-enum";
import { DirectBridge } from "./direct-bridge";
import {
	MIN_GAS_AMOUNT,
	NEAR_NATIVE_ASSET_ID,
} from "./direct-bridge-constants";
import {
	createWithdrawIntentPrimitive,
	withdrawalParamsInvariant,
} from "./direct-bridge-utils";
import { zeroAddress } from "viem";
import { DestinationExplicitNearAccountDoesntExistError } from "./error";
import {
	assert,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";

vi.mock("@defuse-protocol/internal-utils", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@defuse-protocol/internal-utils")>();

	return {
		...actual,
		getNearNep141MinStorageBalance: vi.fn(),
		getNearNep141StorageBalance: vi.fn(),
	};
});

describe("DirectBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
		])("supports NEP-141 even if routeConfig not passed", async (tokenId) => {
			const bridge = new DirectBridge({
				envConfig: configsByEnvironment.production,
				// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used in this test
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
					envConfig: configsByEnvironment.production,
					// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used in this test
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
					envConfig: configsByEnvironment.production,
					// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used in this test
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
					envConfig: configsByEnvironment.production,
					nearProvider: nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					}),
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
				envConfig: configsByEnvironment.production,
				// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used in this test
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
		it.each(["redcroco345"])(
			"blocks withdrawal to explicit accounts that do not exist (not funded) on NEAR",
			async (destinationAddress) => {
				const bridge = new DirectBridge({
					envConfig: configsByEnvironment.production,
					nearProvider: nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					}),
				});

				await expect(
					bridge.validateWithdrawal({
						assetId: "nep141:wrap.near",
						amount: 1n,
						destinationAddress,
					}),
				).rejects.toThrow(DestinationExplicitNearAccountDoesntExistError);
			},
		);

		it.each(["wrap.near", "amogus.near"])(
			"blocks withdrawals of token to it's address",
			async (token) => {
				const bridge = new DirectBridge({
					envConfig: configsByEnvironment.production,
					nearProvider: nearFailoverRpcProvider({
						urls: PUBLIC_NEAR_RPC_URLS,
					}),
				});

				await expect(
					bridge.validateWithdrawal({
						assetId: `nep141:${token}`,
						amount: 1n,
						destinationAddress: token,
					}),
				).rejects.toThrow(DestinationAddressMatchesTokenAddressError);
			},
		);
	});

	describe("estimateWithdrawalFee()", () => {
		it.each([
			{ feesPrefunded: true },
			{ prefundedFeesTokens: ["nep141:usdt.tether-token.near"] },
			{ feesPrefunded: true, prefundedFeesTokens: ["nep141:other.near"] },
		])(
			"skips the fee quote but keeps the storage deposit fee when fees are prefunded via %o",
			async (bridgeConfig) => {
				const bridge = new DirectBridge({
					envConfig: configsByEnvironment.production,
					bridgeConfig,
					// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used, storage deposit cache is seeded below
					nearProvider: {} as any,
				});

				const getFeeQuoteSpy = vi
					.spyOn(estimateFee, "getFeeQuote")
					.mockRejectedValue(
						new Error("getFeeQuote must not be called when fees are prefunded"),
					);

				const minStorageBalance = 1250000000000000000000n;
				const userStorageBalance = 0n;
				// Pre-seed storage deposit cache so estimation does not hit the network.
				// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
				bridge["storageDepositCache"].set("usdt.tether-token.near:alice.near", [
					minStorageBalance,
					userStorageBalance,
				]);

				const result = await bridge.estimateWithdrawalFee({
					withdrawalParams: {
						assetId: "nep141:usdt.tether-token.near",
						destinationAddress: "alice.near",
						routeConfig: createNearWithdrawalRoute(),
					},
				});

				expect(getFeeQuoteSpy).not.toHaveBeenCalled();
				expect(result.amount).toBe(0n);
				expect(result.quote).toBeNull();
				expect(
					result.underlyingFees[RouteEnum.NearWithdrawal]?.storageDepositFee,
				).toBe(minStorageBalance - userStorageBalance);
			},
		);

		it("quotes the fee for a token missing from prefundedFeesTokens", async () => {
			const bridge = new DirectBridge({
				envConfig: configsByEnvironment.production,
				bridgeConfig: { prefundedFeesTokens: ["nep141:other.near"] },
				// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used, storage deposit cache is seeded below
				nearProvider: {} as any,
			});
			const quote = {
				quote_hash: "hash",
				defuse_asset_identifier_in: "nep141:usdt.tether-token.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "5",
				amount_out: "100",
				expiration_time: "",
			};
			const getFeeQuoteSpy = vi
				.spyOn(estimateFee, "getFeeQuote")
				.mockResolvedValue(quote);
			// Pre-seed storage deposit cache so estimation does not hit the network.
			// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
			bridge["storageDepositCache"].set("usdt.tether-token.near:alice.near", [
				100n,
				0n,
			]);

			const result = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId: "nep141:usdt.tether-token.near",
					destinationAddress: "alice.near",
					routeConfig: createNearWithdrawalRoute(),
				},
			});

			expect(getFeeQuoteSpy).toHaveBeenCalledWith(
				expect.objectContaining({ feeAmount: 100n }),
			);
			expect(result).toEqual(expect.objectContaining({ amount: 5n, quote }));
		});

		it("still charges the storage deposit from the amount when withdrawing wrap.near with fees prefunded", async () => {
			const bridge = new DirectBridge({
				envConfig: configsByEnvironment.production,
				bridgeConfig: { feesPrefunded: true },
				// biome-ignore lint/suspicious/noExplicitAny: nearProvider not used, storage deposit cache is seeded below
				nearProvider: {} as any,
			});

			const minStorageBalance = 1250000000000000000000n;
			// Pre-seed storage deposit cache so estimation does not hit the network.
			// biome-ignore lint/complexity/useLiteralKeys: accessing private property for testing
			bridge["storageDepositCache"].set("wrap.near:alice.near", [
				minStorageBalance,
				0n,
			]);

			const result = await bridge.estimateWithdrawalFee({
				withdrawalParams: {
					assetId: "nep141:wrap.near",
					destinationAddress: "alice.near",
					// `msg` forces ft_withdraw of wrap.near, which requires storage deposit
					routeConfig: createNearWithdrawalRoute("hello"),
				},
			});

			expect(result.amount).toBe(minStorageBalance);
			expect(result.quote).toBeNull();
			expect(
				result.underlyingFees[RouteEnum.NearWithdrawal]?.storageDepositFee,
			).toBe(minStorageBalance);
		});
	});
});

describe("DirectBridge.estimateWithdrawalFee()", () => {
	it("does not reuse cached storage of a different pair with the same concatenation", async () => {
		// "wrap.nearalice.near" + "by.near" === "wrap.near" + "alice.nearby.near"
		vi.mocked(getNearNep141MinStorageBalance).mockImplementation(
			async ({ contractId }) => (contractId === "wrap.near" ? 100n : 0n),
		);
		vi.mocked(getNearNep141StorageBalance).mockImplementation(
			async ({ contractId }) => (contractId === "wrap.near" ? 0n : 1n),
		);
		const bridge = new DirectBridge({
			envConfig: configsByEnvironment.production,
			nearProvider: nearFailoverRpcProvider({ urls: PUBLIC_NEAR_RPC_URLS }),
		});

		await bridge.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.nearalice.near",
				destinationAddress: "by.near",
				routeConfig: undefined,
			},
		});
		const fee = await bridge.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				destinationAddress: "alice.nearby.near",
				routeConfig: createNearWithdrawalRoute("msg"),
			},
		});

		expect(fee.underlyingFees).toEqual({
			[RouteEnum.NearWithdrawal]: { storageDepositFee: 100n },
		});
	});
});

describe("createWithdrawIntentPrimitive", () => {
	it("creates native_withdraw intent for NEAR native asset", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: NEAR_NATIVE_ASSET_ID,
			destinationAddress: "alice.near",
			amount: 1000n,
			storageDeposit: 0n,
			msg: undefined,
		});

		expect(result).toEqual({
			intent: "native_withdraw",
			receiver_id: "alice.near",
			amount: "1000",
		});
	});

	it("creates ft_withdraw intent for NEP-141 tokens", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:usdt.tether-token.near",
			destinationAddress: "alice.near",
			amount: 1000n,
			storageDeposit: 0n,
			msg: undefined,
		});

		expect(result).toEqual({
			intent: "ft_withdraw",
			token: "usdt.tether-token.near",
			receiver_id: "alice.near",
			amount: "1000",
			storage_deposit: undefined,
			msg: undefined,
			min_gas: MIN_GAS_AMOUNT,
		});
	});

	it("includes storage_deposit when positive", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:usdt.tether-token.near",
			destinationAddress: "alice.near",
			amount: 1000n,
			storageDeposit: 12500000000000000000000n,
			msg: undefined,
		});

		assert(result.intent === "ft_withdraw"); // typeguard
		expect(result.storage_deposit).toBe("12500000000000000000000");
	});

	it("does not set min_gas when msg is provided", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:usdt.tether-token.near",
			destinationAddress: "alice.near",
			amount: 1000n,
			storageDeposit: 0n,
			msg: "some message",
		});

		assert(result.intent === "ft_withdraw"); // typeguard
		expect(result.min_gas).toBeUndefined();
		expect(result.msg).toBe("some message");
	});

	it("throws for non NEP-141 assets", () => {
		expect(() =>
			createWithdrawIntentPrimitive({
				assetId: "nep245:token.near:1",
				destinationAddress: "alice.near",
				amount: 1000n,
				storageDeposit: 0n,
				msg: undefined,
			}),
		).toThrow("Only NEP-141 is supported");
	});
});

describe("withdrawalParamsInvariant", () => {
	it("passes when routeConfig is undefined", () => {
		const params = { routeConfig: undefined };
		expect(() => withdrawalParamsInvariant(params)).not.toThrow();
	});

	it("passes when routeConfig is NearWithdrawal", () => {
		const params = { routeConfig: createNearWithdrawalRoute() };
		expect(() => withdrawalParamsInvariant(params)).not.toThrow();
	});

	it("throws when routeConfig is not NearWithdrawal", () => {
		const params = {
			routeConfig: createPoaBridgeRoute(),
		};
		expect(() => withdrawalParamsInvariant(params)).toThrow(
			"Bridge is not direct",
		);
	});
});

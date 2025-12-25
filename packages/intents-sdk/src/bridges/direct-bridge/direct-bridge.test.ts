import { describe, expect, it } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import {
	createNearWithdrawalRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
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
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";

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
		it.each(["redcroco345"])(
			"blocks withdrawal to explicit accounts that do not exist (not funded) on NEAR",
			async (destinationAddress) => {
				const bridge = new DirectBridge({
					env: "production",
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

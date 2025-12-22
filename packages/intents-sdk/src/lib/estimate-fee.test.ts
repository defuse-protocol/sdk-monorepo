import { describe, expect, it } from "vitest";
import { RouteEnum } from "../constants/route-enum";
import type { FeeEstimation } from "../shared-types";
import { getUnderlyingFee } from "./estimate-fee";

describe("getUnderlyingFee", () => {
	it("returns the fee value when route exists", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {
				[RouteEnum.HotBridge]: {
					relayerFee: 50n,
					blockNumber: 0n,
				},
			},
		};

		const result = getUnderlyingFee(
			feeEstimation,
			RouteEnum.HotBridge,
			"relayerFee",
		);

		expect(result).toBe(50n);
	});

	it("returns undefined for optional fee when route exists", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {
				[RouteEnum.PoaBridge]: {
					relayerFee: 100n,
				},
			},
		};

		const result = getUnderlyingFee(
			feeEstimation,
			RouteEnum.PoaBridge,
			// @ts-expect-error - We consciously read the incorrect key
			"storageDepositFee",
		);

		expect(result).toBeUndefined();
	});

	it("throws when route fees are missing", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			underlyingFees: {},
		};

		expect(() =>
			getUnderlyingFee(feeEstimation, RouteEnum.HotBridge, "relayerFee"),
		).toThrow('Missing underlying fees for route "hot_bridge"');
	});

	it("throws when underlyingFees is undefined", () => {
		const feeEstimation: FeeEstimation = {
			amount: 100n,
			quote: null,
			// @ts-expect-error - We consciously build an invalid object
			underlyingFees: undefined,
		};

		expect(() =>
			// @ts-expect-error - We consciously read the incorrect key
			getUnderlyingFee(feeEstimation, RouteEnum.PoaBridge, "bridgeFee"),
		).toThrow('Missing underlying fees for route "poa_bridge"');
	});
});

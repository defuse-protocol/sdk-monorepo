import { describe, expect, it, vi } from "vitest";
import { RouteEnum, type RouteEnumValues } from "../constants/route-enum";
import { wait } from "./async";
import type { IntentPrimitive } from "../intents/shared-types";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	WithdrawalDescriptor,
	WithdrawalParams,
} from "../shared-types";
import { Chains } from "./caip2";
import {
	BridgeNotFoundError,
	createWithdrawalDescriptors,
	watchWithdrawal,
	WithdrawalFailedError,
} from "./withdrawal-watcher";

describe("watchWithdrawal", () => {
	it("returns tx info when withdrawal completes immediately", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal").mockResolvedValue({
			status: "completed",
			txHash: "0xabc123",
		});

		const descriptor = createDescriptor();
		const result = await watchWithdrawal({
			bridge,
			descriptor,
			retryOptions: { maxAttempts: 1, delay: 0 },
		});

		expect(result).toEqual({ hash: "0xabc123" });
	});

	it("returns null hash when withdrawal completes without tx hash", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal").mockResolvedValue({
			status: "completed",
			txHash: null,
		});

		const descriptor = createDescriptor();
		const result = await watchWithdrawal({
			bridge,
			descriptor,
			retryOptions: { maxAttempts: 1, delay: 0 },
		});

		expect(result).toEqual({ hash: null });
	});

	it("throws WithdrawalFailedError when withdrawal fails", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal").mockResolvedValue({
			status: "failed",
			reason: "Insufficient funds",
		});

		const descriptor = createDescriptor();
		await expect(
			watchWithdrawal({
				bridge,
				descriptor,
				retryOptions: { maxAttempts: 1, delay: 0 },
			}),
		).rejects.toThrow(WithdrawalFailedError);
	});

	it("retries on pending status and succeeds when completed", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal")
			.mockResolvedValueOnce({ status: "pending" })
			.mockResolvedValueOnce({ status: "pending" })
			.mockResolvedValueOnce({ status: "completed", txHash: "0xfinal" });

		const descriptor = createDescriptor();
		const result = await watchWithdrawal({
			bridge,
			descriptor,
			retryOptions: { maxAttempts: 5, delay: 0 },
		});

		expect(result).toEqual({ hash: "0xfinal" });
		expect(bridge.describeWithdrawal).toHaveBeenCalledTimes(3);
	});

	it("aborts when signal is aborted", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal").mockResolvedValue({
			status: "pending",
		});

		const controller = new AbortController();
		controller.abort();

		const descriptor = createDescriptor();
		await expect(
			watchWithdrawal({
				bridge,
				descriptor,
				signal: controller.signal,
				retryOptions: { maxAttempts: 10, delay: 0 },
			}),
		).rejects.toThrow("aborted");
	});

	it("retries on transient errors and logs them", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal")
			.mockRejectedValueOnce(new Error("Network error"))
			.mockRejectedValueOnce(new Error("Timeout"))
			.mockResolvedValueOnce({ status: "completed", txHash: "0xsuccess" });

		const logger = {
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
			debug: vi.fn(),
			trace: vi.fn(),
		};
		const descriptor = createDescriptor();

		const result = await watchWithdrawal({
			bridge,
			descriptor,
			retryOptions: { maxAttempts: 5, delay: 0 },
			logger,
		});

		expect(result).toEqual({ hash: "0xsuccess" });
		expect(bridge.describeWithdrawal).toHaveBeenCalledTimes(3);
		expect(logger.warn).toHaveBeenCalledTimes(2);
	});

	it("does not retry on WithdrawalFailedError", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "describeWithdrawal").mockResolvedValue({
			status: "failed",
			reason: "Insufficient funds",
		});

		const descriptor = createDescriptor();
		await expect(
			watchWithdrawal({
				bridge,
				descriptor,
				retryOptions: { maxAttempts: 5, delay: 0 },
			}),
		).rejects.toThrow(WithdrawalFailedError);

		expect(bridge.describeWithdrawal).toHaveBeenCalledTimes(1);
	});
});

describe("createWithdrawalDescriptors", () => {
	it("creates descriptors for withdrawals with their bridges", async () => {
		const bridge1 = createMockBridge(RouteEnum.InternalTransfer);
		const bridge2 = createMockBridge(RouteEnum.OmniBridge);

		vi.spyOn(bridge1, "supports").mockResolvedValue(true);
		vi.spyOn(bridge2, "supports").mockResolvedValue(false);

		const result = await createWithdrawalDescriptors({
			bridges: [bridge1, bridge2],
			withdrawalParams: [createWithdrawalParams()],
			intentTx: { hash: "tx-hash", accountId: "test.near" },
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.bridge).toBe(bridge1);
		expect(result[0]?.descriptor.index).toBe(0);
	});

	it("maintains separate index counters per bridge route", async () => {
		const internalBridge = createMockBridge(RouteEnum.InternalTransfer);
		const omniBridge = createMockBridge(RouteEnum.OmniBridge);

		vi.spyOn(internalBridge, "supports")
			.mockResolvedValueOnce(true) // withdrawal 0 -> internal
			.mockResolvedValueOnce(false) // withdrawal 1 -> skip
			.mockResolvedValueOnce(true) // withdrawal 2 -> internal
			.mockResolvedValueOnce(false); // withdrawal 3 -> skip

		vi.spyOn(omniBridge, "supports")
			.mockResolvedValueOnce(true) // withdrawal 1 -> omni
			.mockResolvedValueOnce(true); // withdrawal 3 -> omni

		const withdrawals = [
			createWithdrawalParams(),
			createWithdrawalParams(),
			createWithdrawalParams(),
			createWithdrawalParams(),
		];

		const result = await createWithdrawalDescriptors({
			bridges: [internalBridge, omniBridge],
			withdrawalParams: withdrawals,
			intentTx: { hash: "tx-hash", accountId: "test.near" },
		});

		expect(result[0]?.bridge).toBe(internalBridge);
		expect(result[0]?.descriptor.index).toBe(0);

		expect(result[1]?.bridge).toBe(omniBridge);
		expect(result[1]?.descriptor.index).toBe(0); // separate counter for omni

		expect(result[2]?.bridge).toBe(internalBridge);
		expect(result[2]?.descriptor.index).toBe(1); // continues internal counter

		expect(result[3]?.bridge).toBe(omniBridge);
		expect(result[3]?.descriptor.index).toBe(1); // continues omni counter
	});

	it("throws BridgeNotFoundError when no bridge supports the withdrawal", async () => {
		const bridge = createMockBridge();
		vi.spyOn(bridge, "supports").mockResolvedValue(false);

		await expect(
			createWithdrawalDescriptors({
				bridges: [bridge],
				withdrawalParams: [createWithdrawalParams()],
				intentTx: { hash: "tx-hash", accountId: "test.near" },
			}),
		).rejects.toThrow(BridgeNotFoundError);
	});

	it("returns empty array for empty withdrawal params", async () => {
		const result = await createWithdrawalDescriptors({
			bridges: [createMockBridge()],
			withdrawalParams: [],
			intentTx: { hash: "tx-hash", accountId: "test.near" },
		});

		expect(result).toEqual([]);
	});

	it("preserves index order when async operations complete out of order", async () => {
		const bridge = createMockBridge();

		// Simulate varying network latency: second call completes fastest
		vi.spyOn(bridge, "supports")
			.mockImplementationOnce(() => wait(50).then(() => true)) // A: slow
			.mockImplementationOnce(() => wait(10).then(() => true)) // B: fast
			.mockImplementationOnce(() => wait(30).then(() => true)); // C: medium

		const withdrawals = [
			createWithdrawalParams(),
			createWithdrawalParams(),
			createWithdrawalParams(),
		];

		const result = await createWithdrawalDescriptors({
			bridges: [bridge],
			withdrawalParams: withdrawals,
			intentTx: { hash: "tx-hash", accountId: "test.near" },
		});

		// Indexes must match array order, not completion order
		expect(result[0]?.descriptor.index).toBe(0);
		expect(result[1]?.descriptor.index).toBe(1);
		expect(result[2]?.descriptor.index).toBe(2);
	});
});

function createMockBridge(
	route: RouteEnumValues = RouteEnum.InternalTransfer,
): Bridge {
	return {
		route,
		supports: vi.fn().mockResolvedValue(true),
		parseAssetId(): ParsedAssetInfo | null {
			return null;
		},
		validateWithdrawal(): Promise<void> {
			return Promise.resolve();
		},
		estimateWithdrawalFee(): Promise<FeeEstimation> {
			throw new Error("Not implemented");
		},
		createWithdrawalIntents(): Promise<IntentPrimitive[]> {
			throw new Error("Not implemented");
		},
		createWithdrawalDescriptor(args: {
			withdrawalParams: WithdrawalParams;
			index: number;
			tx: NearTxInfo;
		}): WithdrawalDescriptor {
			return {
				landingChain: Chains.Near,
				index: args.index,
				withdrawalParams: args.withdrawalParams,
				tx: args.tx,
			};
		},
		describeWithdrawal: vi.fn().mockResolvedValue({
			status: "completed" as const,
			txHash: null,
		}),
	};
}

function createDescriptor(): WithdrawalDescriptor {
	return {
		landingChain: Chains.Near,
		index: 0,
		withdrawalParams: createWithdrawalParams(),
		tx: { hash: "tx-hash", accountId: "test.near" },
	};
}

function createWithdrawalParams(): WithdrawalParams {
	return {
		assetId: "nep141:wrap.near",
		amount: 100n,
		destinationAddress: "recipient.near",
		feeInclusive: false,
	};
}

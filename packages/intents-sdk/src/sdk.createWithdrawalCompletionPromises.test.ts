import { describe, expect, it, vi } from "vitest";
import { RouteEnum } from "./constants/route-enum";
import { WithdrawalFailedError } from "./core/withdrawal-watcher";
import { noopIntentSigner } from "./intents/intent-signer-impl/intent-signer-noop";
import type { IntentPrimitive } from "./intents/shared-types";
import { wait } from "./lib/async";
import { type Chain, Chains } from "./lib/caip2";
import { createInternalTransferRoute } from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import type {
	Bridge,
	FeeEstimation,
	ParsedAssetInfo,
	WithdrawalIdentifier,
	WithdrawalStatus,
} from "./shared-types";

describe("sdk.createWithdrawalCompletionPromises()", () => {
	const withdrawalParams = {
		assetId: "nep141:wrap.near",
		amount: 5n,
		destinationAddress: "foo.near",
		feeInclusive: true,
		routeConfig: createInternalTransferRoute(),
	};

	it("returns array of promises matching input length", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockResolvedValue({
			status: "completed",
			txHash: "fake-hash",
		});

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams, withdrawalParams],
		});

		expect(promises).toHaveLength(3);
		expect(promises[0]).toBeInstanceOf(Promise);
		expect(promises[1]).toBeInstanceOf(Promise);
		expect(promises[2]).toBeInstanceOf(Promise);
	});

	it("each promise resolves independently", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockImplementationOnce(() =>
				wait(100).then(() => ({
					status: "completed" as const,
					txHash: "slow-hash",
				})),
			)
			.mockResolvedValueOnce({
				status: "completed",
				txHash: "fast-hash",
			});

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		const second = await promises[1];
		expect(second).toEqual({ hash: "fast-hash" });

		const first = await promises[0];
		expect(first).toEqual({ hash: "slow-hash" });
	});

	it("maintains index correspondence when completions are out of order", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockImplementationOnce(() =>
				wait(50).then(() => ({
					status: "completed" as const,
					txHash: "first-hash",
				})),
			)
			.mockResolvedValueOnce({
				status: "completed",
				txHash: "second-hash",
			});

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		const results = await Promise.all(promises);

		expect(results[0]).toEqual({ hash: "first-hash" });
		expect(results[1]).toEqual({ hash: "second-hash" });
	});

	it("aborts pending promises when signal fires", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockResolvedValue({
			status: "pending",
		});

		const controller = new AbortController();

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams],
			signal: controller.signal,
		});

		setTimeout(() => controller.abort(), 50);

		await expect(promises[0]).rejects.toThrow();
	});

	it("rejects individual promise when withdrawal fails", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockResolvedValueOnce({ status: "completed", txHash: "success-hash" })
			.mockResolvedValueOnce({
				status: "failed",
				reason: "Insufficient funds",
			});

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		await expect(promises[0]).resolves.toEqual({ hash: "success-hash" });
		await expect(promises[1]).rejects.toThrow(WithdrawalFailedError);
	});

	it("returns empty array for empty withdrawalParams", async () => {
		const { sdk } = setupMocks();

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [],
		});

		expect(promises).toEqual([]);
	});
});

describe("sdk.createWithdrawalCompletionPromises() - HOT bridge sequential waiting", () => {
	const hotWithdrawalParams = {
		assetId: "nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		amount: 1n,
		destinationAddress: "0xdead698d1ff2efca2c4c1f171d6a92dd3b3e5e73",
		feeInclusive: false,
	};

	const hotWithdrawalParamsPolygon = {
		...hotWithdrawalParams,
		assetId: "nep245:v2_1.omni.hot.tg:137_11111111111111111111",
	};

	it("waits for previous HOT withdrawal to same chain before starting next", async () => {
		const { sdk, mockBridge } = setupMocksWithHotBridge({ chain: Chains.BNB });
		const { promise, resolve } = Promise.withResolvers<void>();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockImplementationOnce(async () => {
				await promise;
				return { status: "completed", txHash: "hash-1" };
			})
			.mockResolvedValueOnce({ status: "completed", txHash: "hash-2" });

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "tx" },
			withdrawalParams: [hotWithdrawalParams, hotWithdrawalParams],
		});

		// Let event loop run - if parallel, second would have called describeWithdrawal;
		await new Promise((r) => setImmediate(r));
		expect(mockBridge.describeWithdrawal).toHaveBeenCalledTimes(1);

		resolve();
		await Promise.all(promises);
		expect(mockBridge.describeWithdrawal).toHaveBeenCalledTimes(2);
	});

	it("runs HOT withdrawals to different chains in parallel", async () => {
		const { sdk, mockBridgeBnb, mockBridgePolygon } =
			setupMocksWithTwoHotBridges();
		const { promise, resolve } = Promise.withResolvers<void>();

		vi.mocked(mockBridgeBnb.describeWithdrawal).mockImplementationOnce(
			async () => {
				await promise;
				return { status: "completed", txHash: "bnb-hash" };
			},
		);

		vi.mocked(mockBridgePolygon.describeWithdrawal).mockResolvedValueOnce({
			status: "completed",
			txHash: "polygon-hash",
		});

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "tx" },
			withdrawalParams: [hotWithdrawalParams, hotWithdrawalParamsPolygon],
		});

		// Let event loop run - parallel means both start immediately
		await new Promise((r) => setImmediate(r));
		expect(mockBridgeBnb.describeWithdrawal).toHaveBeenCalledTimes(1);
		expect(mockBridgePolygon.describeWithdrawal).toHaveBeenCalledTimes(1);

		resolve();
		await Promise.all(promises);
	});

	it("continues with next withdrawal even if previous fails", async () => {
		const { sdk, mockBridge } = setupMocksWithHotBridge({ chain: Chains.BNB });

		vi.mocked(mockBridge.describeWithdrawal)
			.mockResolvedValueOnce({ status: "failed", reason: "cancelled" })
			.mockResolvedValueOnce({ status: "completed", txHash: "hash-2" });

		const promises = sdk.createWithdrawalCompletionPromises({
			intentTx: { accountId: "foo.near", hash: "tx" },
			withdrawalParams: [hotWithdrawalParams, hotWithdrawalParams],
		});

		// First should fail
		await expect(promises[0]).rejects.toThrow(WithdrawalFailedError);

		// Second should still complete (allSettled allows continuation)
		const second = await promises[1];
		expect(second).toEqual({ hash: "hash-2" });
	});
});

class NoopBridge implements Bridge {
	readonly route: Bridge["route"] = RouteEnum.InternalTransfer;
	readonly landingChain: Chain = Chains.Near;

	async createWithdrawalIntents(): Promise<IntentPrimitive[]> {
		throw new Error("Not implemented.");
	}

	estimateWithdrawalFee(): Promise<FeeEstimation> {
		throw new Error("Not implemented.");
	}

	parseAssetId(): ParsedAssetInfo | null {
		throw new Error("Not implemented.");
	}

	async supports(_params: { assetId: string }): Promise<boolean> {
		return true;
	}

	validateWithdrawal(): Promise<void> {
		throw new Error("Not implemented.");
	}

	createWithdrawalIdentifier(args: {
		withdrawalParams: Parameters<
			Bridge["createWithdrawalIdentifier"]
		>[0]["withdrawalParams"];
		index: number;
		tx: Parameters<Bridge["createWithdrawalIdentifier"]>[0]["tx"];
	}): WithdrawalIdentifier {
		return {
			landingChain: this.landingChain,
			index: args.index,
			withdrawalParams: args.withdrawalParams,
			tx: args.tx,
		};
	}

	describeWithdrawal(): Promise<WithdrawalStatus> {
		throw new Error("Not implemented.");
	}
}

function createMockSDK(bridges: Bridge[]) {
	class MockSDK extends IntentsSDK {
		constructor(...args: ConstructorParameters<typeof IntentsSDK>) {
			super(...args);
			this.bridges = bridges;
		}
	}
	return new MockSDK({ referral: "", intentSigner: noopIntentSigner });
}

function setupMocks() {
	const mockBridge = new NoopBridge();
	vi.spyOn(mockBridge, "describeWithdrawal");

	return {
		sdk: createMockSDK([mockBridge]),
		mockBridge,
	};
}

function setupMocksWithHotBridge({ chain }: { chain: Chain }) {
	class MockHotBridge extends NoopBridge {
		override readonly route = RouteEnum.HotBridge;
		override readonly landingChain = chain;
	}

	const mockBridge = new MockHotBridge();
	vi.spyOn(mockBridge, "describeWithdrawal");

	return {
		sdk: createMockSDK([mockBridge]),
		mockBridge,
	};
}

function setupMocksWithTwoHotBridges() {
	class MockHotBridgeBnb extends NoopBridge {
		override readonly route = RouteEnum.HotBridge;
		override readonly landingChain = Chains.BNB;

		override async supports(params: { assetId: string }): Promise<boolean> {
			return params.assetId.includes(":56_");
		}
	}

	class MockHotBridgePolygon extends NoopBridge {
		override readonly route = RouteEnum.HotBridge;
		override readonly landingChain = Chains.Polygon;

		override async supports(params: { assetId: string }): Promise<boolean> {
			return params.assetId.includes(":137_");
		}
	}

	const mockBridgeBnb = new MockHotBridgeBnb();
	const mockBridgePolygon = new MockHotBridgePolygon();
	vi.spyOn(mockBridgeBnb, "describeWithdrawal");
	vi.spyOn(mockBridgePolygon, "describeWithdrawal");

	return {
		sdk: createMockSDK([mockBridgeBnb, mockBridgePolygon]),
		mockBridgeBnb,
		mockBridgePolygon,
	};
}

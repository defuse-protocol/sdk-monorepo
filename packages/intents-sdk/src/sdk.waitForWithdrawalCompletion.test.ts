import { describe, expect, it, vi } from "vitest";
import { BridgeNameEnum } from "./constants/bridge-name-enum";
import { RouteEnum } from "./constants/route-enum";
import { noopIntentSigner } from "./intents/intent-signer-impl/intent-signer-noop";
import type { IntentPrimitive } from "./intents/shared-types";
import { wait } from "./lib/async";
import { Chains } from "./lib/caip2";
import { createInternalTransferRoute } from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import type {
	Bridge,
	FeeEstimation,
	ParsedAssetInfo,
	WithdrawalDescriptor,
	WithdrawalStatus,
} from "./shared-types";

describe("sdk.waitForWithdrawalCompletion()", () => {
	const withdrawalParams = {
		assetId: "nep141:wrap.near",
		amount: 5n,
		destinationAddress: "foo.near",
		feeInclusive: true,
		routeConfig: createInternalTransferRoute(),
	};

	it("supports single withdrawal", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockResolvedValueOnce({
			status: "completed",
			txHash: "fake-dest-hash",
		});

		const result = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
		});

		await expect(result).resolves.toEqual({ hash: "fake-dest-hash" });
	});

	it("supports multiple withdrawals (preserving tx info order)", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockImplementationOnce(() =>
				wait(300).then(() => ({
					status: "completed" as const,
					txHash: "fake-dest-hash-1",
				})),
			)
			.mockResolvedValueOnce({
				status: "completed",
				txHash: "fake-dest-hash-2",
			});

		const result = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		await expect(result).resolves.toEqual([
			{ hash: "fake-dest-hash-1" },
			{ hash: "fake-dest-hash-2" },
		]);
		expect(mockBridge.describeWithdrawal).toHaveBeenCalledTimes(2);
	});

	it("determines withdrawal routes if not passed", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockResolvedValue({
			status: "completed",
			txHash: "fake-dest-hash",
		});
		vi.mocked(mockBridge.parseAssetId).mockReturnValue({
			blockchain: Chains.Near,
			bridgeName: BridgeNameEnum.None,
			standard: "nep141",
			contractId: "",
			address: "",
		});

		await sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [
				withdrawalParams,
				{
					...withdrawalParams,
					routeConfig: undefined,
				},
			],
		});

		expect(mockBridge.describeWithdrawal).toHaveBeenCalledTimes(2);
	});

	it("maintains indexes specific to bridge route", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockResolvedValue({
			status: "completed",
			txHash: "fake-dest-hash",
		});

		await sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams, withdrawalParams],
		});

		expect(mockBridge.describeWithdrawal).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ index: 0 }),
		);
		expect(mockBridge.describeWithdrawal).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ index: 1 }),
		);
		expect(mockBridge.describeWithdrawal).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ index: 2 }),
		);
	});

	it("throws error when no bridge supports the route", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.spyOn(mockBridge, "supports").mockResolvedValue(false);

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
		});

		await expect(promise).rejects.toThrow("Bridge adapter not found");
	});

	it("handles bridge method failures gracefully", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal).mockRejectedValue(
			new Error("Bridge connection failed"),
		);

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
			retryOptions: { maxAttempts: 1, delay: 0 },
		});

		await expect(promise).rejects.toThrow("Bridge connection failed");
	});

	it("handles mixed success/failure in array withdrawals", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.describeWithdrawal)
			.mockResolvedValueOnce({ status: "completed", txHash: "success-hash" })
			.mockRejectedValueOnce(new Error("Second withdrawal failed"));

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
			retryOptions: { maxAttempts: 1, delay: 0 },
		});

		await expect(promise).rejects.toThrow("Second withdrawal failed");
	});

	it("handles empty withdrawal params array", async () => {
		const { sdk } = setupMocks();

		const result = await sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [],
		});

		expect(result).toEqual([]);
	});
});

function setupMocks() {
	class MockBridge implements Bridge {
		readonly route = RouteEnum.InternalTransfer;

		async createWithdrawalIntents(): Promise<IntentPrimitive[]> {
			throw new Error("Not implemented.");
		}

		estimateWithdrawalFee(): Promise<FeeEstimation> {
			throw new Error("Not implemented.");
		}

		parseAssetId(): ParsedAssetInfo | null {
			throw new Error("Not implemented.");
		}

		async supports(): Promise<boolean> {
			return true;
		}

		validateWithdrawal(): Promise<void> {
			throw new Error("Not implemented.");
		}

		createWithdrawalDescriptor(args: {
			withdrawalParams: Parameters<
				Bridge["createWithdrawalDescriptor"]
			>[0]["withdrawalParams"];
			index: number;
			tx: Parameters<Bridge["createWithdrawalDescriptor"]>[0]["tx"];
		}): WithdrawalDescriptor {
			return {
				landingChain: Chains.Near,
				index: args.index,
				withdrawalParams: args.withdrawalParams,
				tx: args.tx,
			};
		}

		describeWithdrawal(): Promise<WithdrawalStatus> {
			throw new Error("Not implemented.");
		}
	}

	const mockBridge = new MockBridge();
	vi.spyOn(mockBridge, "describeWithdrawal");
	vi.spyOn(mockBridge, "parseAssetId");

	class MockSDK extends IntentsSDK {
		constructor(...args: ConstructorParameters<typeof IntentsSDK>) {
			super(...args);
			this.bridges = [mockBridge];
		}
	}

	const sdk = new MockSDK({ referral: "", intentSigner: noopIntentSigner });

	return {
		sdk,
		mockBridge,
	};
}

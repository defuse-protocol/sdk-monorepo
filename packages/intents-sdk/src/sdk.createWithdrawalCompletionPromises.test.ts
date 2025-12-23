import { describe, expect, it, vi } from "vitest";
import { RouteEnum } from "./constants/route-enum";
import { WithdrawalFailedError } from "./core/withdrawal-watcher";
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

		createWithdrawalIdentifier(args: {
			withdrawalParams: Parameters<
				Bridge["createWithdrawalIdentifier"]
			>[0]["withdrawalParams"];
			index: number;
			tx: Parameters<Bridge["createWithdrawalIdentifier"]>[0]["tx"];
		}): WithdrawalIdentifier {
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

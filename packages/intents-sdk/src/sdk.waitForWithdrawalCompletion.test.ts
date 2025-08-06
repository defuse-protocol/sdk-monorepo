import { describe, expect, it, vi } from "vitest";
import { BridgeNameEnum } from "./constants/bridge-name-enum";
import { noopIntentSigner } from "./intents/intent-signer-impl/intent-signer-noop";
import type { IntentPrimitive } from "./intents/shared-types";
import { wait } from "./lib/async";
import { Chains } from "./lib/caip2";
import {
	createInternalTransferRoute,
	createNearWithdrawalRoute,
} from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import type {
	Bridge,
	FeeEstimation,
	ParsedAssetInfo,
	TxInfo,
	TxNoInfo,
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

		const txInfo = { hash: "fake-dest-hash" };
		vi.mocked(mockBridge.waitForWithdrawalCompletion).mockResolvedValueOnce(
			txInfo,
		);

		const result = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
		});

		await expect(result).resolves.toEqual(txInfo);
	});

	it("supports multiple withdrawals (preserving tx info order)", async () => {
		const { sdk, mockBridge } = setupMocks();

		const txInfo1 = { hash: "fake-dest-hash-1" };
		const txInfo2 = { hash: "fake-dest-hash-2" };

		vi.mocked(mockBridge.waitForWithdrawalCompletion)
			.mockImplementationOnce(() => wait(300).then(() => txInfo1))
			.mockResolvedValueOnce(txInfo2);

		const result = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		await expect(result).resolves.toEqual([txInfo1, txInfo2]);
		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenCalledTimes(2);
	});

	it("determines withdrawal routes if not passed", async () => {
		const { sdk, mockBridge } = setupMocks();

		const txInfo = { hash: "fake-dest-hash" };
		vi.mocked(mockBridge.waitForWithdrawalCompletion).mockResolvedValue(txInfo);
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

		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ routeConfig: expect.any(Object) }),
		);
		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ routeConfig: expect.any(Object) }),
		);
	});

	it("maintains indexes specific to withdrawal route", async () => {
		const { sdk, mockBridge } = setupMocks();

		const txInfo = { hash: "fake-dest-hash" };
		vi.mocked(mockBridge.waitForWithdrawalCompletion).mockResolvedValue(txInfo);

		await sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [
				{
					...withdrawalParams,
					routeConfig: createNearWithdrawalRoute(),
				},
				withdrawalParams,
				withdrawalParams,
			],
		});

		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ index: 0 }),
		);
		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ index: 0 }),
		);
		expect(mockBridge.waitForWithdrawalCompletion).toHaveBeenNthCalledWith(
			3,
			expect.objectContaining({ index: 1 }),
		);
	});

	it("throws error when no bridge supports the route", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.spyOn(mockBridge, "is").mockReturnValue(false);

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
		});

		await expect(promise).rejects.toThrow("Unsupported route");
	});

	it("handles bridge method failures gracefully", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.waitForWithdrawalCompletion).mockRejectedValue(
			new Error("Bridge connection failed"),
		);

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: withdrawalParams,
		});

		await expect(promise).rejects.toThrow("Bridge connection failed");
	});

	it("handles mixed success/failure in array withdrawals", async () => {
		const { sdk, mockBridge } = setupMocks();

		const txInfo = { hash: "success-hash" };
		vi.mocked(mockBridge.waitForWithdrawalCompletion)
			.mockResolvedValueOnce(txInfo)
			.mockRejectedValueOnce(new Error("Second withdrawal failed"));

		const promise = sdk.waitForWithdrawalCompletion({
			intentTx: { accountId: "foo.near", hash: "fake-hash" },
			withdrawalParams: [withdrawalParams, withdrawalParams],
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
		async createWithdrawalIntents(): Promise<IntentPrimitive[]> {
			throw new Error("Not implemented.");
		}

		estimateWithdrawalFee(): Promise<FeeEstimation> {
			throw new Error("Not implemented.");
		}

		is(): boolean {
			return true;
		}

		parseAssetId(): ParsedAssetInfo | null {
			throw new Error("Not implemented.");
		}

		supports(): boolean {
			return true;
		}

		validateWithdrawal(): Promise<void> {
			throw new Error("Not implemented.");
		}

		waitForWithdrawalCompletion(): Promise<TxInfo | TxNoInfo> {
			throw new Error("Not implemented.");
		}
	}

	const mockBridge = new MockBridge();
	vi.spyOn(mockBridge, "waitForWithdrawalCompletion");
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

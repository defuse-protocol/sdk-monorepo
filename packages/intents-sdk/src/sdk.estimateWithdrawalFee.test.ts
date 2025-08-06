import { describe, expect, it, vi } from "vitest";
import { FeeExceedsAmountError } from "./classes/errors";
import { noopIntentSigner } from "./intents/intent-signer-impl/intent-signer-noop";
import type { IntentPrimitive } from "./intents/shared-types";
import { wait } from "./lib/async";
import { createInternalTransferRoute } from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import type {
	Bridge,
	FeeEstimation,
	ParsedAssetInfo,
	TxInfo,
	TxNoInfo,
} from "./shared-types";

describe("sdk.estimateWithdrawalFee()", () => {
	const withdrawalParams = {
		assetId: "nep141:wrap.near",
		amount: 100n,
		destinationAddress: "foo.near",
		feeInclusive: false,
		routeConfig: createInternalTransferRoute(),
	};

	const feeEstimation = {
		amount: 10n,
		quote: null,
	};

	it("supports single withdrawal", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.estimateWithdrawalFee).mockResolvedValueOnce(
			feeEstimation,
		);

		const result = await sdk.estimateWithdrawalFee({
			withdrawalParams: withdrawalParams,
		});

		expect(result).toEqual(feeEstimation);
		expect(mockBridge.estimateWithdrawalFee).toHaveBeenCalledWith(
			expect.objectContaining({
				withdrawalParams: withdrawalParams,
			}),
		);
	});

	it("supports multiple withdrawals", async () => {
		const { sdk, mockBridge } = setupMocks();

		const feeEstimation1 = { ...feeEstimation, amount: 10n };
		const feeEstimation2 = { ...feeEstimation, amount: 20n };

		vi.mocked(mockBridge.estimateWithdrawalFee)
			.mockResolvedValueOnce(feeEstimation1)
			.mockResolvedValueOnce(feeEstimation2);

		const result = await sdk.estimateWithdrawalFee({
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		expect(result).toEqual([feeEstimation1, feeEstimation2]);
		expect(mockBridge.estimateWithdrawalFee).toHaveBeenCalledTimes(2);
	});

	it("processes multiple withdrawals concurrently", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.estimateWithdrawalFee)
			.mockImplementationOnce(() => wait(300).then(() => feeEstimation))
			.mockResolvedValueOnce(feeEstimation);

		const startTime = Date.now();
		const result = await sdk.estimateWithdrawalFee({
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});
		const duration = Date.now() - startTime;

		expect(result).toEqual([feeEstimation, feeEstimation]);
		expect(duration).toBeLessThan(400); // Should be closer to 300ms, not 600ms
	});

	it("throws error when no bridge supports the withdrawal", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.supports).mockReturnValue(false);

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: withdrawalParams,
		});

		await expect(promise).rejects.toThrow(
			"Cannot determine bridge for withdrawal",
		);
	});

	it("handles bridge method failures", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.estimateWithdrawalFee).mockRejectedValue(
			new Error("Bridge estimation failed"),
		);

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: withdrawalParams,
		});

		await expect(promise).rejects.toThrow("Bridge estimation failed");
	});

	it("handles mixed success/failure in array withdrawals", async () => {
		const { sdk, mockBridge } = setupMocks();

		vi.mocked(mockBridge.estimateWithdrawalFee)
			.mockResolvedValueOnce(feeEstimation)
			.mockRejectedValueOnce(new Error("Second estimation failed"));

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: [withdrawalParams, withdrawalParams],
		});

		await expect(promise).rejects.toThrow("Second estimation failed");
	});

	it("throws FeeExceedsAmountError when fee inclusive and fee > amount", async () => {
		const { sdk, mockBridge } = setupMocks();

		const highFee = { ...feeEstimation, amount: 150n }; // Higher than withdrawal amount
		const feeInclusiveParams = { ...withdrawalParams, feeInclusive: true };

		vi.mocked(mockBridge.estimateWithdrawalFee).mockResolvedValue(highFee);

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: feeInclusiveParams,
		});

		await expect(promise).rejects.toThrow(FeeExceedsAmountError);
	});

	it("disallows fee equal to amount when fee inclusive", async () => {
		const { sdk, mockBridge } = setupMocks();

		const equalFee = { ...feeEstimation, amount: 100n }; // Equal to withdrawal amount
		const feeInclusiveParams = { ...withdrawalParams, feeInclusive: true };

		vi.mocked(mockBridge.estimateWithdrawalFee).mockResolvedValue(equalFee);

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: feeInclusiveParams,
		});

		await expect(promise).rejects.toThrow(FeeExceedsAmountError);
	});

	it("skips fee validation when not fee inclusive", async () => {
		const { sdk, mockBridge } = setupMocks();

		const highFee = { ...feeEstimation, amount: 150n }; // Higher than withdrawal amount
		const nonFeeInclusiveParams = { ...withdrawalParams, feeInclusive: false };

		vi.mocked(mockBridge.estimateWithdrawalFee).mockResolvedValue(highFee);

		const result = await sdk.estimateWithdrawalFee({
			withdrawalParams: nonFeeInclusiveParams,
		});

		expect(result).toEqual(highFee);
	});

	it("handles empty withdrawal params array", async () => {
		const { sdk } = setupMocks();

		const result = await sdk.estimateWithdrawalFee({
			withdrawalParams: [],
		});

		expect(result).toEqual([]);
	});

	it("validates fee for each withdrawal in array when fee inclusive", async () => {
		const { sdk, mockBridge } = setupMocks();

		const validFee = { ...feeEstimation, amount: 50n };
		const invalidFee = { ...feeEstimation, amount: 150n };
		const feeInclusiveParams = { ...withdrawalParams, feeInclusive: true };

		vi.mocked(mockBridge.estimateWithdrawalFee)
			.mockResolvedValueOnce(validFee)
			.mockResolvedValueOnce(invalidFee);

		const promise = sdk.estimateWithdrawalFee({
			withdrawalParams: [feeInclusiveParams, feeInclusiveParams],
		});

		await expect(promise).rejects.toThrow(FeeExceedsAmountError);
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
	vi.spyOn(mockBridge, "estimateWithdrawalFee");
	vi.spyOn(mockBridge, "supports");

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

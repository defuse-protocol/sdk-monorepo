import { AssertionError } from "@defuse-protocol/internal-utils";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "./intents/intent-signer-impl/factories";
import { createInternalTransferRoute } from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import type { ISaltManager } from "./intents/interfaces/salt-manager";
import type { Salt } from "./intents/expirable-nonce";

describe("sdk.signAndSendWithdrawalIntent()", () => {
	const withdrawalParams = {
		assetId: "nep141:wrap.near",
		amount: 5n,
		destinationAddress: "foo.near",
		feeInclusive: true,
		routeConfig: createInternalTransferRoute(),
	};
	const fee = { amount: 0n, quote: null, feeBreakdown: null };

	it("supports single withdrawal", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		void sdk.signAndSendWithdrawalIntent({
			withdrawalParams: withdrawalParams,
			feeEstimation: fee,
		});

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);

		expect(vi.mocked(defaultIntentSigner.signIntent).mock.lastCall).toEqual([
			{
				...AnyIntent,
				intents: [AnyTransferIntentPrimitive],
			},
		]);
	});

	it("supports batch withdrawals", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		void sdk.signAndSendWithdrawalIntent({
			withdrawalParams: [
				withdrawalParams,
				withdrawalParams,
				withdrawalParams,
				withdrawalParams,
			],
			feeEstimation: [fee, fee, fee, fee],
		});

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);

		expect(vi.mocked(defaultIntentSigner.signIntent).mock.lastCall).toEqual([
			{
				...AnyIntent,
				intents: [
					AnyTransferIntentPrimitive,
					AnyTransferIntentPrimitive,
					AnyTransferIntentPrimitive,
					AnyTransferIntentPrimitive,
				],
			},
		]);
	});

	it("throws if some fee are missing", async () => {
		const { sdk } = setupMocks();

		const p = sdk.signAndSendWithdrawalIntent({
			withdrawalParams: [withdrawalParams, withdrawalParams],
			feeEstimation: [fee],
		});

		await expect(p).rejects.toThrowError(AssertionError);
	});

	it("throws if some withdrawalParams are missing", async () => {
		const { sdk } = setupMocks();

		const p = sdk.signAndSendWithdrawalIntent({
			withdrawalParams: [withdrawalParams],
			feeEstimation: [fee, fee],
		});

		await expect(p).rejects.toThrowError(AssertionError);
	});
});

function setupMocks() {
	class MockSaltManager implements ISaltManager {
		async getCachedSalt(): Promise<Salt> {
			return Uint8Array.from([1, 2, 3, 4]);
		}

		async refresh(): Promise<Salt> {
			return Uint8Array.from([5, 6, 7, 8]);
		}
	}

	const defaultIntentSigner = createIntentSignerViem({
		signer: privateKeyToAccount(
			// random private key
			"0x8dc677035d99f1ce679131376ca7acda01a51ce6e77ec5d7a2cf4a1ab37a8499",
		),
	});
	vi.spyOn(defaultIntentSigner, "signIntent");

	const intentSigner2 = createIntentSignerViem({
		signer: privateKeyToAccount(
			// random private key
			"0x8dc677035d99f1ce679131376ca7acda01a51ce6e77ec5d7a2cf4a1ab37a8499",
		),
	});
	vi.spyOn(intentSigner2, "signIntent");

	const intentRelayer = new IntentRelayerPublic({ env: "production" });
	vi.spyOn(intentRelayer, "publishIntent");

	const saltManager = new MockSaltManager();

	class MockSDK extends IntentsSDK {
		constructor(...args: ConstructorParameters<typeof IntentsSDK>) {
			super(...args);
			this.intentRelayer = intentRelayer;
			this.saltManager = saltManager;
		}
	}

	const sdk = new MockSDK({ referral: "", intentSigner: defaultIntentSigner });

	return {
		sdk,
		intentRelayer,
		defaultIntentSigner,
		intentSigner2,
	};
}

function noPublish(intentRelayer: IntentRelayerPublic) {
	vi.mocked(intentRelayer.publishIntent).mockImplementation(
		async () => new Promise(() => {}),
	);
}

const AnyIntent = {
	deadline: expect.any(String),
	intents: expect.any(Object),
	nonce: expect.any(String),
	signer_id: undefined,
	verifying_contract: "intents.near",
};

const AnyTransferIntentPrimitive = {
	intent: "transfer",
	receiver_id: expect.any(String),
	tokens: expect.any(Object),
};

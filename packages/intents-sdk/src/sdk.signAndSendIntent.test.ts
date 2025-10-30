import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "./intents/intent-signer-impl/factories";
import { IntentsSDK } from "./sdk";
import type { ISaltManager } from "./intents/interfaces/salt-manager";
import type { Salt } from "./intents/expirable-nonce";
import { RelayPublishError } from "@defuse-protocol/internal-utils";

describe("sdk.signAndSendIntent()", () => {
	it("signs with default signer", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		void sdk.signAndSendIntent({ intents: [] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);
		expect(defaultIntentSigner.signIntent).toHaveBeenCalledWith(AnyEmptyIntent);
	});

	it("signs with overridden signer", async () => {
		const { sdk, intentRelayer, defaultIntentSigner, intentSigner2 } =
			setupMocks();
		noPublish(intentRelayer);

		sdk.setIntentSigner(intentSigner2);

		void sdk.signAndSendIntent({ intents: [] });

		await vi.waitFor(() =>
			expect(intentSigner2.signIntent).toHaveBeenCalledOnce(),
		);
		expect(intentSigner2.signIntent).toHaveBeenCalledWith(AnyEmptyIntent);
		expect(defaultIntentSigner.signIntent).not.toHaveBeenCalled();
	});

	it("sends signed intent", async () => {
		const { sdk, intentRelayer } = setupMocks();
		noPublish(intentRelayer);

		void sdk.signAndSendIntent({ intents: [] });

		await vi.waitFor(() =>
			expect(intentRelayer.publishIntent).toHaveBeenCalledOnce(),
		);
		expect(intentRelayer.publishIntent).toHaveBeenCalledWith(
			{
				multiPayload: {
					payload: expect.any(String),
					signature: expect.any(String),
					standard: "erc191",
				},
			},
			expect.any(Object),
		);
	});

	it("retry salt fetching", async () => {
		const { sdk, intentRelayer, saltManager } = setupMocks();
		noPublish(intentRelayer);

		// Fail on any error exept salt error
		vi.mocked(intentRelayer.publishIntent).mockRejectedValueOnce(
			new RelayPublishError({
				reason: "nonce was already used",
				code: "NONCE_USED",
			}),
		);

		let res = sdk.signAndSendIntent({ intents: [] });

		await expect(res).rejects.toBeInstanceOf(RelayPublishError);

		expect(saltManager.refresh).toHaveBeenCalledTimes(0);
		expect(saltManager.getCachedSalt).toHaveBeenCalledTimes(1);

		// Retry on salt error
		vi.mocked(intentRelayer.publishIntent).mockRejectedValueOnce(
			new RelayPublishError({ reason: "Invalid salt", code: "INVALID_SALT" }),
		);

		void sdk.signAndSendIntent({ intents: [] });

		await vi.waitFor(() => expect(saltManager.refresh).toHaveBeenCalledOnce());

		expect(saltManager.refresh).toHaveBeenCalledTimes(1);
		expect(saltManager.getCachedSalt).toHaveBeenCalledTimes(2);
	});
});

function setupMocks() {
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

	vi.spyOn(saltManager, "getCachedSalt");
	vi.spyOn(saltManager, "refresh");

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
		saltManager,
	};
}

function noPublish(intentRelayer: IntentRelayerPublic) {
	vi.mocked(intentRelayer.publishIntent).mockImplementation(
		async () => new Promise(() => {}),
	);
}

const AnyEmptyIntent = {
	deadline: expect.any(String),
	intents: [],
	nonce: expect.any(String),
	signer_id: undefined,
	verifying_contract: "intents.near",
};

class MockSaltManager implements ISaltManager {
	async getCachedSalt(): Promise<Salt> {
		return Uint8Array.from([1, 2, 3, 4]);
	}

	async refresh(): Promise<Salt> {
		return Uint8Array.from([5, 6, 7, 8]);
	}
}

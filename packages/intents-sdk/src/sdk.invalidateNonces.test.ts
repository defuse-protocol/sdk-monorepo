import { configsByEnvironment } from "@defuse-protocol/internal-utils";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "./intents/intent-signer-impl/factories";
import { IntentsSDK } from "./sdk";
import type { ISaltManager } from "./intents/interfaces/salt-manager";
import type { Salt } from "./intents/expirable-nonce";
import { VersionedNonceBuilder } from "./intents/expirable-nonce";

describe("sdk.invalidateNonces()", () => {
	it("invalidates single nonce", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		const nonce = "VigoxLwmUGf35MGLVBG9Fh5cCtJw3D68pSKFcqGCkHU=";

		void sdk.invalidateNonces({ nonces: [nonce] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);
		expect(defaultIntentSigner.signIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				nonce,
				intents: [],
			}),
		);
	});

	it("invalidates multiple nonces", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		const nonces = [
			"VigoxLwmUGf35MGLVBG9Fh5cCtJw3D68pSKFcqGCkHU=",
			"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=",
			"lsLpUoT0zvHcy1vPAEhdcY7jkUVJv1jYtdfFWkFGyvs=",
		];

		void sdk.invalidateNonces({ nonces });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledTimes(3),
		);

		for (const nonce of nonces) {
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledWith(
				expect.objectContaining({
					nonce,
					intents: [],
				}),
			);
		}
	});

	it("extracts deadline from expirable nonce", async () => {
		const { sdk, intentRelayer, defaultIntentSigner, saltManager } =
			setupMocks();
		noPublish(intentRelayer);

		// Create a nonce with a deadline in one month (should use 1 minute instead)
		const farFutureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		const salt = await saltManager.getCachedSalt();
		const nonce = VersionedNonceBuilder.encodeNonce(salt, farFutureDeadline);

		void sdk.invalidateNonces({ nonces: [nonce] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);

		// Verify that the deadline is approximately 1 minute from now (not the far future)
		const call = vi.mocked(defaultIntentSigner.signIntent).mock.calls[0];
		// biome-ignore lint/style/noNonNullAssertion: test context guarantees call exists
		const payload = call![0];

		const actualDeadline = new Date(payload.deadline);
		const expectedDeadline = new Date(Date.now() + 60_000); // 1 minute from now
		const timeDiff = Math.abs(
			actualDeadline.getTime() - expectedDeadline.getTime(),
		);

		// Should be within 1 second of expected (allowing for test execution time)
		expect(timeDiff).toBeLessThan(1000);
		expect(payload.nonce).toBe(nonce);
		expect(payload.intents).toEqual([]);
	});

	it("uses nonce deadline when it's sooner than 1 minute", async () => {
		const { sdk, intentRelayer, defaultIntentSigner, saltManager } =
			setupMocks();
		noPublish(intentRelayer);

		// Create a nonce with a deadline 30 seconds from now
		const soonDeadline = new Date(Date.now() + 30_000);
		const salt = await saltManager.getCachedSalt();
		const nonce = VersionedNonceBuilder.encodeNonce(salt, soonDeadline);

		void sdk.invalidateNonces({ nonces: [nonce] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);

		// Verify that the deadline matches the nonce's deadline (not 1 minute)
		expect(defaultIntentSigner.signIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				nonce,
				deadline: soonDeadline.toISOString(),
				intents: [],
			}),
		);
	});

	it("publishes all invalidation intents atomically", async () => {
		const { sdk, intentRelayer } = setupMocks();
		noPublish(intentRelayer);

		const nonces = [
			"VigoxLwmUGf35MGLVBG9Fh5cCtJw3D68pSKFcqGCkHU=",
			"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=",
		];

		void sdk.invalidateNonces({ nonces });

		await vi.waitFor(() =>
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce(),
		);

		expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
			expect.objectContaining({
				multiPayloads: expect.arrayContaining([
					expect.objectContaining({
						payload: expect.any(String),
						signature: expect.any(String),
					}),
				]),
			}),
			expect.any(Object),
		);
	});

	it("uses overridden signer", async () => {
		const { sdk, intentRelayer, defaultIntentSigner, intentSigner2 } =
			setupMocks();
		noPublish(intentRelayer);

		const nonce = "VigoxLwmUGf35MGLVBG9Fh5cCtJw3D68pSKFcqGCkHU=";

		void sdk.invalidateNonces({ nonces: [nonce], signer: intentSigner2 });

		await vi.waitFor(() =>
			expect(intentSigner2.signIntent).toHaveBeenCalledOnce(),
		);
		expect(intentSigner2.signIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				nonce,
				intents: [],
			}),
		);
		expect(defaultIntentSigner.signIntent).not.toHaveBeenCalled();
	});

	it("handles empty nonce array", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		await sdk.invalidateNonces({ nonces: [] });

		expect(defaultIntentSigner.signIntent).not.toHaveBeenCalled();
		expect(intentRelayer.publishIntent).not.toHaveBeenCalled();
		expect(intentRelayer.publishIntents).not.toHaveBeenCalled();
	});

	it("gracefully handles invalid nonce format", async () => {
		const { sdk, intentRelayer, defaultIntentSigner } = setupMocks();
		noPublish(intentRelayer);

		// Use an invalid/old format nonce that can't be decoded
		const invalidNonce = "invalid-nonce-format";

		void sdk.invalidateNonces({ nonces: [invalidNonce] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledOnce(),
		);

		// Should still create intent with the nonce, just without extracted deadline
		expect(defaultIntentSigner.signIntent).toHaveBeenCalledWith(
			expect.objectContaining({
				nonce: invalidNonce,
				intents: [],
				// deadline will be default (1 minute from now)
			}),
		);
	});

	it("handles mix of valid and invalid nonces", async () => {
		const { sdk, intentRelayer, defaultIntentSigner, saltManager } =
			setupMocks();
		noPublish(intentRelayer);

		const farFutureDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
		const salt = await saltManager.getCachedSalt();
		const validNonce = VersionedNonceBuilder.encodeNonce(
			salt,
			farFutureDeadline,
		);
		const invalidNonce = "invalid-format";

		void sdk.invalidateNonces({ nonces: [validNonce, invalidNonce] });

		await vi.waitFor(() =>
			expect(defaultIntentSigner.signIntent).toHaveBeenCalledTimes(2),
		);

		// First call should have 1 minute deadline (shorter than nonce's far future deadline)
		const firstCall = vi.mocked(defaultIntentSigner.signIntent).mock.calls[0];
		// biome-ignore lint/style/noNonNullAssertion: test context guarantees call exists
		const firstPayload = firstCall![0];
		expect(firstPayload.nonce).toBe(validNonce);

		const firstDeadline = new Date(firstPayload.deadline);
		const expectedDeadline = new Date(Date.now() + 60_000);
		const timeDiff = Math.abs(
			firstDeadline.getTime() - expectedDeadline.getTime(),
		);
		expect(timeDiff).toBeLessThan(1000); // Within 1 second

		// Second call should use default deadline (invalid nonce)
		expect(defaultIntentSigner.signIntent).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				nonce: invalidNonce,
				intents: [],
			}),
		);
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

	const intentRelayer = new IntentRelayerPublic({
		envConfig: configsByEnvironment.production,
	});
	vi.spyOn(intentRelayer, "publishIntent");
	vi.spyOn(intentRelayer, "publishIntents");

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
	vi.mocked(intentRelayer.publishIntents).mockImplementation(
		async () => new Promise(() => {}),
	);
}

class MockSaltManager implements ISaltManager {
	async getCachedSalt(): Promise<Salt> {
		return Uint8Array.from([1, 2, 3, 4]);
	}

	async refresh(): Promise<Salt> {
		return Uint8Array.from([5, 6, 7, 8]);
	}
}

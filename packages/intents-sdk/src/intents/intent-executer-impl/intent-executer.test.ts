import { base64 } from "@scure/base";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "../intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "../intent-signer-impl/factories";
import { IntentExecuter } from "./intent-executer";
import { defaultIntentPayloadFactory } from "../intent-payload-factory";

describe("IntentExecuter", () => {
	it("appends argument intents to factory produced intents", async () => {
		const { intentSigner } = setupMocks();

		vi.mocked(intentSigner.signIntent).mockImplementation(
			() => new Promise(() => {}),
		);

		const exec = new IntentExecuter({
			env: "production",
			intentRelayer: new IntentRelayerPublic({ env: "production" }),
			intentSigner,
			intentPayloadFactory() {
				return {
					intents: [
						{
							intent: "invalidate_nonces",
							nonces: ["my_nonce"],
						},
					],
				};
			},
		});

		void exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "foo.near",
					tokens: {},
				},
			],
		});

		await vi.waitFor(() =>
			expect(intentSigner.signIntent).toHaveBeenCalledOnce(),
		);
		expect(intentSigner.signIntent).toHaveBeenCalledWith({
			deadline: expect.any(String),
			intents: [
				{
					intent: "invalidate_nonces",
					nonces: ["my_nonce"],
				},
				{
					intent: "transfer",
					receiver_id: "foo.near",
					tokens: {},
				},
			],
			nonce: expect.any(String),
			signer_id: undefined,
			verifying_contract: "intents.near",
		});
	});

	it("removes duplicated intents", async () => {
		const { intentSigner } = setupMocks();

		vi.mocked(intentSigner.signIntent).mockImplementation(
			() => new Promise(() => {}),
		);

		const exec = new IntentExecuter({
			env: "production",
			intentRelayer: new IntentRelayerPublic({ env: "production" }),
			intentSigner,
			intentPayloadFactory(intentPayload) {
				return {
					intents: [
						...intentPayload.intents,
						{
							intent: "invalidate_nonces",
							nonces: ["my_nonce"],
						},
					],
				};
			},
		});

		void exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "foo.near",
					tokens: {},
				},
			],
		});

		await vi.waitFor(() =>
			expect(intentSigner.signIntent).toHaveBeenCalledOnce(),
		);
		expect(intentSigner.signIntent).toHaveBeenCalledWith({
			deadline: expect.any(String),
			intents: [
				{
					intent: "transfer",
					receiver_id: "foo.near",
					tokens: {},
				},
				{
					intent: "invalidate_nonces",
					nonces: ["my_nonce"],
				},
			],
			nonce: expect.any(String),
			signer_id: undefined,
			verifying_contract: "intents.near",
		});
	});

	it("calls onBeforePublishIntent hook", async () => {
		const { intentSigner, intentRelayer } = setupMocks();

		vi.mocked(intentRelayer.publishIntent).mockImplementation(async () => {
			return "fake-ticket";
		});

		const onBeforePublishIntent = vi.fn();

		const exec = new IntentExecuter({
			env: "production",
			intentRelayer,
			intentSigner,
			onBeforePublishIntent,
		});

		void exec.signAndSendIntent({
			intents: [],
			deadline: "2025-07-30T12:57:16.264Z",
			nonce: base64.encode(new Uint8Array(32)),
		});

		await vi.waitFor(() =>
			expect(onBeforePublishIntent).toHaveBeenCalledOnce(),
		);
		expect(onBeforePublishIntent).toHaveBeenCalledWith({
			intentHash: "4MVPyDY6kpmSRsQGmGwDjp8NL7Z2VhhX5RDsCVHrLT9W",
			intentPayload: {
				deadline: "2025-07-30T12:57:16.264Z",
				intents: [],
				nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
				signer_id: undefined,
				verifying_contract: "intents.near",
			},
			multiPayload: {
				payload:
					'{"signer_id":"0x3ae806ffd613bed6cf57056e79b5c96c07c27ff4","verifying_contract":"intents.near","deadline":"2025-07-30T12:57:16.264Z","nonce":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","intents":[]}',
				signature:
					"secp256k1:KQVNobKqhvDb8uEeHqn5QSCJzraiMhASytvrVtZzZGYdiYWrbbFyeUaTAdVGJ9bT18ZRTK3wQNXAY1akDQck7Pa2t",
				standard: "erc191",
			},
			relayParams: {},
		});
	});

	describe("Intent Composition", () => {
		it("publishes single intent without composition", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			vi.mocked(intentRelayer.publishIntent).mockResolvedValue("ticket-123");

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

			const result = await exec.signAndSendIntent({
				intents: [
					{
						intent: "transfer",
						receiver_id: "alice.near",
						tokens: { "wrap.near": "1000" },
					},
				],
			});

			expect(result.ticket).toBe("ticket-123");
			expect(intentRelayer.publishIntent).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).not.toHaveBeenCalled();
		});

		it("composes intents with prepend only", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			const prependIntent1 = await intentSigner.signIntent(
				defaultIntentPayloadFactory({ verifying_contract: "" }),
			);

			const prependIntent2 = await intentSigner.signIntent(
				defaultIntentPayloadFactory({ verifying_contract: "" }),
			);

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash-prepend-1",
				"hash-prepend-2",
				"hash-new-intent",
			]);

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		const result = await exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "alice.near",
					tokens: { "wrap.near": "1000" },
				},
			],
			signedIntents: {
				before: [prependIntent1, prependIntent2],
			},
		});			// Should return the hash of the newly created intent (at index 2)
			expect(result.ticket).toBe("hash-new-intent");

			// Should call publishIntents with all 3 payloads with correct order
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
				expect.objectContaining({
					multiPayloads: [
						prependIntent1,
						prependIntent2,
						expect.objectContaining({ standard: "erc191" }),
					],
				}),
				expect.any(Object),
			);
		});

		it("composes intents with append only", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			const appendIntent1 = await intentSigner.signIntent(
				defaultIntentPayloadFactory({ verifying_contract: "" }),
			);
			const appendIntent2 = await intentSigner.signIntent(
				defaultIntentPayloadFactory({ verifying_contract: "" }),
			);

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash-new-intent",
				"hash-append-1",
				"hash-append-2",
			]);

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		const result = await exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "bob.near",
					tokens: { "usdc.near": "5000" },
				},
			],
			signedIntents: {
				after: [appendIntent1, appendIntent2],
			},
		});			// Should return the hash of the newly created intent (at index 0)
			expect(result.ticket).toBe("hash-new-intent");

			// Should call publishIntents with all 3 payloads with correct order
			expect(intentRelayer.publishIntents).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
				expect.objectContaining({
					multiPayloads: [
						expect.objectContaining({ standard: "erc191" }),
						appendIntent1,
						appendIntent2,
					],
				}),
				expect.any(Object),
			);
		});

		it("composes intents with both prepend and append", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			const prependIntent = {
				payload: "prepend-payload",
				signature: "sig-pre",
				standard: "nep413",
				public_key: "ed25519:test",
			} as const;

			const appendIntent = {
				payload: "append-payload",
				signature: "sig-app",
				standard: "nep413",
				public_key: "ed25519:test",
			} as const;

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash-prepend",
				"hash-new-intent",
				"hash-append",
			]);

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		const result = await exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "charlie.near",
					tokens: {},
				},
			],
			signedIntents: {
				before: [prependIntent],
				after: [appendIntent],
			},
		});			// Should return the hash of the newly created intent (at index 1)
			expect(result.ticket).toBe("hash-new-intent");

			// Verify order: prepend → new intent → append
			const call = vi.mocked(intentRelayer.publishIntents).mock.calls[0];
			if (call) {
				const payloads = call[0].multiPayloads;
				expect(payloads).toHaveLength(3);
				expect(payloads[0]).toBe(prependIntent);
				expect(payloads[1]).toMatchObject({ standard: "erc191" });
				expect(payloads[2]).toBe(appendIntent);
			}
		});

		it("handles empty prepend array", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			vi.mocked(intentRelayer.publishIntent).mockResolvedValue("ticket-456");

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		const result = await exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "dave.near",
					tokens: {},
				},
			],
			signedIntents: {
				before: [], // Empty array
			},
		});			// Should use single intent publishing
			expect(result.ticket).toBe("ticket-456");
			expect(intentRelayer.publishIntent).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).not.toHaveBeenCalled();
		});

		it("handles undefined composition", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			vi.mocked(intentRelayer.publishIntent).mockResolvedValue("ticket-789");

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		const result = await exec.signAndSendIntent({
			intents: [
				{
					intent: "transfer",
					receiver_id: "eve.near",
					tokens: {},
				},
			],
			signedIntents: undefined,
		});			// Should use single intent publishing
			expect(result.ticket).toBe("ticket-789");
			expect(intentRelayer.publishIntent).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).not.toHaveBeenCalled();
		});

		it("passes quote hashes to batch publisher", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			const prependIntent = {
				payload: "prepend-payload",
				signature: "sig",
				standard: "nep413",
				public_key: "ed25519:test",
			} as const;

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash1",
				"hash2",
			]);

			const exec = new IntentExecuter({
				env: "production",
				intentRelayer,
				intentSigner,
			});

		await exec.signAndSendIntent({
			intents: [],
			signedIntents: {
				before: [prependIntent],
			},
			relayParams: async () => ({
				quoteHashes: ["quote-hash-1", "quote-hash-2"],
			}),
		});			expect(intentRelayer.publishIntents).toHaveBeenCalledWith(
				expect.objectContaining({
					quoteHashes: ["quote-hash-1", "quote-hash-2"],
				}),
				expect.any(Object),
			);
		});
	});
});

function setupMocks() {
	const intentSigner = createIntentSignerViem({
		signer: privateKeyToAccount(
			// random private key
			"0x8dc677035d99f1ce679131376ca7acda01a51ce6e77ec5d7a2cf4a1ab37a8499",
		),
	});
	vi.spyOn(intentSigner, "signIntent");

	const intentRelayer = new IntentRelayerPublic({ env: "production" });
	vi.spyOn(intentRelayer, "publishIntent");
	vi.spyOn(intentRelayer, "publishIntents");

	return { intentSigner, intentRelayer };
}

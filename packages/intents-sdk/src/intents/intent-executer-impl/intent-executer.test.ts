import { configsByEnvironment } from "@defuse-protocol/internal-utils";
import { providers } from "near-api-js";
import { base64 } from "@scure/base";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "../intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "../intent-signer-impl/factories";
import { IntentExecuter } from "./intent-executer";
import { defaultIntentPayloadFactory } from "../intent-payload-factory";
import { SaltManager } from "../salt-manager";

describe("IntentExecuter", () => {
	it("appends argument intents to factory produced intents", async () => {
		const { intentSigner } = setupMocks();

		vi.mocked(intentSigner.signIntent).mockImplementation(
			() => new Promise(() => {}),
		);

		const exec = new IntentExecuter({
			envConfig: configsByEnvironment.production,
			intentRelayer: new IntentRelayerPublic({
				envConfig: configsByEnvironment.production,
			}),
			intentSigner,
			intentPayloadFactory() {
				return {
					intents: [
						{
							intent: "add_public_key",
							public_key: "my_pk",
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
			salt: Uint8Array.from([1, 2, 3, 4]),
		});

		await vi.waitFor(() =>
			expect(intentSigner.signIntent).toHaveBeenCalledOnce(),
		);
		expect(intentSigner.signIntent).toHaveBeenCalledWith({
			deadline: expect.any(String),
			intents: [
				{
					intent: "add_public_key",
					public_key: "my_pk",
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
			envConfig: configsByEnvironment.production,
			intentRelayer: new IntentRelayerPublic({
				envConfig: configsByEnvironment.production,
			}),
			intentSigner,
			intentPayloadFactory(intentPayload) {
				return {
					intents: [
						...intentPayload.intents,
						{
							intent: "add_public_key",
							public_key: "my_pk",
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
			salt: Uint8Array.from([1, 2, 3, 4]),
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
					intent: "add_public_key",
					public_key: "my_pk",
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
			envConfig: configsByEnvironment.production,
			intentRelayer,
			intentSigner,
			onBeforePublishIntent,
		});

		void exec.signAndSendIntent({
			intents: [],
			salt: Uint8Array.from([1, 2, 3, 4]),
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

	it("throws if onBeforePublishIntent hook throws", async () => {
		const { intentSigner, intentRelayer } = setupMocks();

		const onBeforePublishIntent = async () => {
			throw new Error("dummy error");
		};

		const exec = new IntentExecuter({
			envConfig: configsByEnvironment.production,
			intentRelayer,
			intentSigner,
			onBeforePublishIntent,
		});

		const result = exec.signAndSendIntent({
			intents: [],
			salt: Uint8Array.from([1, 2, 3, 4]),
			deadline: "2025-07-30T12:57:16.264Z",
			nonce: base64.encode(new Uint8Array(32)),
		});

		await expect(result).rejects.toThrow("dummy error");
		expect(intentRelayer.publishIntent).not.toHaveBeenCalled();
	});

	it("allows to override the deadline", async () => {
		const { intentSigner, intentRelayer } = setupMocks();

		const rpc = new providers.JsonRpcProvider({
			url: "https://near-rpc.defuse.org",
		});

		const exec = new IntentExecuter({
			envConfig: configsByEnvironment.production,
			intentRelayer,
			intentSigner,
			intentPayloadFactory: () => ({
				deadline: "2100-01-01T12:00:00.000Z",
			}),
			onBeforePublishIntent: async ({ multiPayload, intentPayload }) => {
				expect(intentPayload.deadline).toEqual("2100-01-01T12:00:00.000Z");

				// If simulation does not throw, then multipayload is valid
				await rpc.query({
					request_type: "call_function",
					account_id: "intents.near",
					method_name: "simulate_intents",
					args_base64: btoa(JSON.stringify({ signed: [multiPayload] })),
					finality: "optimistic",
				});

				// Interrupt, so it's not published
				throw new Error("ok");
			},
		});

		const saltManager = new SaltManager({
			envConfig: configsByEnvironment.production,
			nearProvider: rpc,
		});

		const promise = exec.signAndSendIntent({
			salt: await saltManager.getCachedSalt(),
		});
		await expect(promise).rejects.toThrow("ok");
		expect.assertions(2);
	});

	describe("Intent Composition", () => {
		it("publishes single intent without composition", async () => {
			const { intentSigner, intentRelayer } = setupMocks();

			vi.mocked(intentRelayer.publishIntent).mockResolvedValue("ticket-123");

			const exec = new IntentExecuter({
				envConfig: configsByEnvironment.production,
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
				salt: Uint8Array.from([1, 2, 3, 4]),
			});

			expect(result.ticket).toBe("ticket-123");
			expect(intentRelayer.publishIntent).toHaveBeenCalledOnce();
			expect(intentRelayer.publishIntents).not.toHaveBeenCalled();
		});

		it("composes intents with prepend only", async () => {
			const { intentSigner, intentRelayer } = setupMocks();
			const salt = Uint8Array.from([1, 2, 3, 4]);

			const prependIntent1 = await intentSigner.signIntent(
				defaultIntentPayloadFactory(salt, { verifying_contract: "" }),
			);
			const prependIntent2 = await intentSigner.signIntent(
				defaultIntentPayloadFactory(salt, { verifying_contract: "" }),
			);

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash-prepend-1",
				"hash-prepend-2",
				"hash-new-intent",
			]);

			const exec = new IntentExecuter({
				envConfig: configsByEnvironment.production,
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
				salt,
			});

			// Should return the hash of the newly created intent (at index 2)
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
			const salt = Uint8Array.from([1, 2, 3, 4]);

			const appendIntent1 = await intentSigner.signIntent(
				defaultIntentPayloadFactory(salt, { verifying_contract: "" }),
			);
			const appendIntent2 = await intentSigner.signIntent(
				defaultIntentPayloadFactory(salt, { verifying_contract: "" }),
			);

			vi.mocked(intentRelayer.publishIntents).mockResolvedValue([
				"hash-new-intent",
				"hash-append-1",
				"hash-append-2",
			]);

			const exec = new IntentExecuter({
				envConfig: configsByEnvironment.production,
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
				salt: Uint8Array.from([1, 2, 3, 4]),
			});

			// Should return the hash of the newly created intent (at index 0)
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

	const intentRelayer = new IntentRelayerPublic({
		envConfig: configsByEnvironment.production,
	});
	vi.spyOn(intentRelayer, "publishIntent");
	vi.spyOn(intentRelayer, "publishIntents");

	return { intentSigner, intentRelayer };
}

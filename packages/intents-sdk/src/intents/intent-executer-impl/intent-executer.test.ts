import { base64 } from "@scure/base";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "../intent-relayer-impl/intent-relayer-public";
import { createIntentSignerViem } from "../intent-signer-impl/factories";
import { IntentExecuter } from "./intent-executer";

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

	return { intentSigner, intentRelayer };
}

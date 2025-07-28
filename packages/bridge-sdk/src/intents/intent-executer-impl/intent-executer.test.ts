import type { MultiPayload } from "@defuse-protocol/contract-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntentRelayerPublic } from "../intent-relayer-impl";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload } from "../shared-types";
import { IntentExecuter } from "./intent-executer";

describe("IntentExecuter", () => {
	let intentSigner: IIntentSigner;

	beforeEach(() => {
		intentSigner = {
			signIntent: vi.fn((_: IntentPayload): Promise<MultiPayload> => {
				throw new Error("Function not implemented.");
			}),
		};
	});

	it("appends argument intents to factory produced intents", async () => {
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
});

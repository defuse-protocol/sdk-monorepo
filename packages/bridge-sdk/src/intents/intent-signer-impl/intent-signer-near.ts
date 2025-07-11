import { base58, base64 } from "@scure/base";
import { hashNEP413Message } from "../../lib/nep413";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

export class IntentSignerNear implements IIntentSigner {
	private signer: import("near-api-js").KeyPair;
	private accountId: string;

	constructor({
		signer,
		accountId,
	}: {
		signer: import("near-api-js").KeyPair;
		accountId: string;
	}) {
		this.signer = signer;
		this.accountId = accountId;
	}

	async signIntent(intent: IntentPayload): Promise<MultiPayload> {
		const nep413 = {
			recipient: intent.verifying_contract,
			nonce: base64.decode(intent.nonce),
			message: JSON.stringify({
				deadline: intent.deadline,
				intents: intent.intents,
				signer_id: intent.signer_id ?? this.accountId,
			}),
			callback_url: null,
		};

		const hash = await hashNEP413Message(nep413);

		const { publicKey, signature } = this.signer.sign(hash);

		return {
			standard: "nep413",
			payload: {
				...nep413,
				nonce: intent.nonce,
			},
			public_key: publicKey.toString(),
			signature: `ed25519:${base58.encode(signature)}`,
		};
	}
}

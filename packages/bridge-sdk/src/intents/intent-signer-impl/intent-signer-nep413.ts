import { base58, base64 } from "@scure/base";
import { hashNEP413Message, type NEP413Payload } from "../../lib/nep413";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

type MaybePromise<T> = T | Promise<T>;

type SignMessageNEP413 = (
	nep413Payload: NEP413Payload,
	nep413Hash: Uint8Array,
) => MaybePromise<{
	// The public counterpart of the key used to sign, expressed as a string with format "<key-type>:<base58-key-bytes>" (e.g. "ed25519:6TupyNrcHGTt5XRLmHTc2KGaiSbjhQi1KHtCXTgbcr4Y")
	publicKey: string;
	// The base64 representation of the signature.
	signature: string;
}>;

export interface IntentSignerNEP413Config {
	signMessage: SignMessageNEP413;
	accountId: string;
}

export class IntentSignerNEP413 implements IIntentSigner {
	private signMessage: SignMessageNEP413;
	private accountId: string;

	constructor({ signMessage, accountId }: IntentSignerNEP413Config) {
		this.signMessage = signMessage;
		this.accountId = accountId;
	}

	async signIntent(intent: IntentPayload): Promise<MultiPayload> {
		const nep413Payload: NEP413Payload = {
			recipient: intent.verifying_contract,
			nonce: Array.from(base64.decode(intent.nonce)),
			message: JSON.stringify({
				deadline: intent.deadline,
				intents: intent.intents,
				signer_id: intent.signer_id ?? this.accountId,
			}),
		};

		const nep413Hash = await hashNEP413Message(nep413Payload);

		const { publicKey, signature } = await this.signMessage(
			nep413Payload,
			nep413Hash,
		);
		const signatureFormatted = `ed25519:${base58.encode(base64.decode(signature))}`;

		return {
			standard: "nep413",
			payload: {
				...nep413Payload,
				nonce: intent.nonce,
			},
			public_key: publicKey,
			signature: signatureFormatted,
		};
	}
}

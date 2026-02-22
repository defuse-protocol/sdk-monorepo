import type { MultiPayloadNep413 } from "@defuse-protocol/contract-types";
import { base58, base64 } from "@scure/base";
import { type NEP413Payload, hashNEP413Message } from "../../lib/nep413";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload } from "../shared-types";

export type Nep413RawPayload = Pick<MultiPayloadNep413, "payload">;

type MaybePromise<T> = T | Promise<T>;

type SignMessageNEP413 = (
	nep413Payload: NEP413Payload,
	nep413Hash: Uint8Array,
) => MaybePromise<{
	// The public counterpart of the key used to sign, expressed as a string with format "<key-type>:<base58-key-bytes>" (e.g. "ed25519:6TupyNrcHGTt5XRLmHTc2KGaiSbjhQi1KHtCXTgbcr4Y")
	publicKey: string;
	// The base64 representation of the signature or "<key-type>:<base58-signature-bytes>"
	signature: string;
}>;

export interface IntentSignerNEP413Config {
	signMessage: SignMessageNEP413;
	accountId: string;
}

export class IntentSignerNEP413 implements IIntentSigner {
	readonly standard = "nep413" as const;

	private signMessageFn: SignMessageNEP413;
	protected accountId: string;

	constructor({ signMessage, accountId }: IntentSignerNEP413Config) {
		this.signMessageFn = signMessage;
		this.accountId = accountId;
	}

	async signRaw(input: Nep413RawPayload): Promise<MultiPayloadNep413> {
		const nep413Payload: NEP413Payload = {
			message: input.payload.message,
			nonce: Array.from(base64.decode(input.payload.nonce)),
			recipient: input.payload.recipient,
			callback_url: input.payload.callbackUrl,
		};

		const nep413Hash = await hashNEP413Message(nep413Payload);

		const { publicKey, signature } = await this.signMessageFn(
			nep413Payload,
			nep413Hash,
		);

		const signatureFormatted = signature.startsWith("ed25519:")
			? signature
			: `ed25519:${base58.encode(base64.decode(signature))}`;

		return {
			standard: "nep413",
			payload: input.payload,
			public_key: publicKey,
			signature: signatureFormatted,
		};
	}

	/** Builds payload from IntentPayload and signs it via signRaw() */
	async signIntent(intent: IntentPayload): Promise<MultiPayloadNep413> {
		return this.signRaw({
			payload: {
				message: JSON.stringify({
					deadline: intent.deadline,
					intents: intent.intents,
					signer_id: intent.signer_id ?? this.accountId,
				}),
				nonce: intent.nonce,
				recipient: intent.verifying_contract,
			},
		});
	}
}

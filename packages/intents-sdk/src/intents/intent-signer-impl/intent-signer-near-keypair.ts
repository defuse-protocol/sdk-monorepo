import { base64 } from "@scure/base";
import type { IIntentSigner } from "../interfaces/intent-signer";
import { IntentSignerNEP413 } from "./intent-signer-nep413";

export interface IntentSignerNearKeypairConfig {
	/**
	 * Instance of near-api-js's KeyPair type
	 */
	signer: import("near-api-js").KeyPair;
	/**
	 * Account ID to be used as signer_id of the intent.
	 */
	accountId: string;
}

export class IntentSignerNearKeypair
	extends IntentSignerNEP413
	implements IIntentSigner
{
	constructor({ signer, accountId }: IntentSignerNearKeypairConfig) {
		super({
			signMessage: (_nep413Payload, nep413Hash) => {
				const { publicKey, signature } = signer.sign(nep413Hash);
				return {
					publicKey: publicKey.toString(),
					signature: base64.encode(signature),
				};
			},
			accountId,
		});
	}
}

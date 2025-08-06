import { base64 } from "@scure/base";
import type { IIntentSigner } from "../interfaces/intent-signer";
import { IntentSignerNEP413 } from "./intent-signer-nep413";

export interface IntentSignerNearKeypairConfig {
	keypair: import("near-api-js").KeyPair;
	accountId: string;
}

export class IntentSignerNearKeypair
	extends IntentSignerNEP413
	implements IIntentSigner
{
	constructor({ keypair, accountId }: IntentSignerNearKeypairConfig) {
		super({
			signMessage: (_nep413Payload, nep413Hash) => {
				const { publicKey, signature } = keypair.sign(nep413Hash);
				return {
					publicKey: publicKey.toString(),
					signature: base64.encode(signature),
				};
			},
			accountId,
		});
	}
}

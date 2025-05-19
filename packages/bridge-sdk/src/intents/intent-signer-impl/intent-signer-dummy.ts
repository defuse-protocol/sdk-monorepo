import type { IIntentSigner } from "../interfaces/intent-signer.ts";
import type { IntentPayload, MultiPayload } from "../shared-types.ts";

export class IntentSignerDummy implements IIntentSigner {
	async signIntent(_intent: IntentPayload): Promise<MultiPayload> {
		throw new Error("not implemented");
	}
}

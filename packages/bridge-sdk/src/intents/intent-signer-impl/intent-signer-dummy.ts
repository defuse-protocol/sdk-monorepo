import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

export class IntentSignerDummy implements IIntentSigner {
	async signIntent(_intent: IntentPayload): Promise<MultiPayload> {
		throw new Error("not implemented");
	}
}

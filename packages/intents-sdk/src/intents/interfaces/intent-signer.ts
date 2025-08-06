import type { IntentPayload, MultiPayload } from "../shared-types";

export interface IIntentSigner {
	signIntent(intent: IntentPayload): Promise<MultiPayload>;
}

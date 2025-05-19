import type { IntentPayload, MultiPayload } from "../shared-types.ts";

export interface IIntentSigner {
	signIntent(intent: IntentPayload): Promise<MultiPayload>;
}

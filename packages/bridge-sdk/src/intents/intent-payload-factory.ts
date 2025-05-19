import { base64 } from "@scure/base";
import type { IntentPayload, IntentPrimitive } from "./shared-types.ts";

export function defaultIntentPayloadFactory({
	intents,
	...params
}: Partial<Omit<IntentPayload, "intents">> & {
	intents: IntentPrimitive | IntentPrimitive[];
}) {
	return {
		verifying_contract: "intents.near",
		deadline: new Date(Date.now() + 60 * 1000).toISOString(),
		nonce: base64.encode(crypto.getRandomValues(new Uint8Array(32))),
		intents: Array.isArray(intents) ? intents : [intents],
		signer_id: undefined, // or you can specify intent user id
		...params,
	};
}

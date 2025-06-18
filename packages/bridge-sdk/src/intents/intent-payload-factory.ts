import { base64 } from "@scure/base";
import type { IntentPayload } from "./shared-types.ts";

export function defaultIntentPayloadFactory({
	intents,
	...params
}: Partial<IntentPayload>): IntentPayload {
	// remove `undefined` properties
	params = Object.fromEntries(
		Object.entries(params).filter(([, value]) => value !== undefined),
	);

	return {
		verifying_contract: "intents.near",
		deadline: new Date(Date.now() + 60 * 1000).toISOString(),
		nonce: base64.encode(crypto.getRandomValues(new Uint8Array(32))),
		intents: intents == null ? [] : intents,
		signer_id: undefined, // or you can specify intent user id
		...params,
	};
}

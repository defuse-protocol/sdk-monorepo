import { base64 } from "@scure/base";
import type { IntentPayload } from "./shared-types";

export function defaultIntentPayloadFactory({
	intents,
	verifying_contract,
	...params
}: Partial<IntentPayload> &
	Pick<IntentPayload, "verifying_contract">): IntentPayload {
	// remove `undefined` properties
	params = Object.fromEntries(
		Object.entries(params).filter(([, value]) => value !== undefined),
	);

	return {
		signer_id: undefined, // or you can specify intent user id
		...params,
		verifying_contract,
		deadline: new Date(Date.now() + 60 * 1000).toISOString(),
		nonce: base64.encode(crypto.getRandomValues(new Uint8Array(32))),
		intents: intents == null ? [] : intents,
	};
}

import { buildAndEncodeExpirableNonce } from "./expirable-nonce";
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

	let deadline = new Date(Date.now() + 60 * 1000);
	return {
		verifying_contract,
		deadline: deadline.toISOString(),
		nonce: buildAndEncodeExpirableNonce(deadline),
		intents: intents == null ? [] : intents,
		signer_id: undefined, // or you can specify intent user id
		...params,
	};
}

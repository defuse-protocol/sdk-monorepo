import { VersionedNonceBuilder, type Salt } from "./expirable-nonce";
import type { IntentPayload } from "./shared-types";

const DEFAULT_DEADLINE_MS = 60 * 1000; // 1 minute

export function defaultIntentPayloadFactory(
	salt: Salt,
	{
		intents,
		verifying_contract,
		...params
	}: Partial<IntentPayload> & Pick<IntentPayload, "verifying_contract">,
): IntentPayload {
	// remove `undefined` properties
	params = Object.fromEntries(
		Object.entries(params).filter(([, value]) => value !== undefined),
	);

	const deadline = new Date(Date.now() + DEFAULT_DEADLINE_MS);
	return {
		verifying_contract,
		deadline: deadline.toISOString(),
		nonce: VersionedNonceBuilder.encodeNonce(salt, deadline),
		intents: intents == null ? [] : intents,
		signer_id: undefined, // or you can specify intent user id
		...params,
	};
}

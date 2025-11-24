import { VersionedNonceBuilder, type Salt } from "./expirable-nonce";
import type { IntentPayload } from "./shared-types";

export const DEFAULT_DEADLINE_MS = 60 * 1000; // 1 minute
// In coming future separate deadline fields will be removed from intents.
// Nonces are the only places where deadlines remain.
// So it's important they have the same value.
export const DEFAULT_NONCE_DEADLINE_OFFSET_MS = DEFAULT_DEADLINE_MS;

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

	const deadline =
		params.deadline != null
			? new Date(params.deadline)
			: new Date(Date.now() + DEFAULT_DEADLINE_MS);
	const nonceDeadline = new Date(
		deadline.getTime() + DEFAULT_NONCE_DEADLINE_OFFSET_MS,
	);

	return {
		verifying_contract,
		deadline: deadline.toISOString(),
		nonce: VersionedNonceBuilder.encodeNonce(salt, nonceDeadline),
		intents: intents == null ? [] : intents,
		signer_id: undefined, // or you can specify intent user id
		...params,
	};
}

import { VersionedNonceBuilder, type Salt } from "./expirable-nonce";
import type { IntentPayload } from "./shared-types";

export const DEFAULT_DEADLINE_MS = 60 * 1000; // 1 minute
// Nonces embed their own deadline, so add 30s buffer so solvers can still send
// empty intents that invalidate near-expiry quotas without missing the nonce deadline.
export const DEFAULT_NONCE_DEADLINE_OFFSET_MS = 30 * 1000;

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

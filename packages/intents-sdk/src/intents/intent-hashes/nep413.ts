import type { MultiPayload } from "@defuse-protocol/contract-types";
import { base64 } from "@scure/base";
import { hashNEP413Message } from "../../lib/nep413";

/**
 * Compute hash from a signed NEP-413 payload
 *
 * @param signed - The signed NEP-413 payload
 * @returns 32-byte hash as Uint8Array
 */
export async function computeSignedNep413Hash(
	signed: Extract<MultiPayload, { standard: "nep413" }>,
): Promise<Uint8Array> {
	// For NEP-413, we need to reconstruct the original message that was hashed
	const payload = signed.payload;

	return hashNEP413Message({
		message: payload.message,
		recipient: payload.recipient,
		nonce: Array.from(base64.decode(payload.nonce)),
		callback_url: payload.callbackUrl,
	});
}

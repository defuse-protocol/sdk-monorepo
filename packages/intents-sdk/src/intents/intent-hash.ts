import { keccak_256 } from "@noble/hashes/sha3";
import { base58, base64 } from "@scure/base";
import { hashNEP413Message } from "../lib/nep413";
import type { IntentHash, MultiPayload } from "./shared-types";

/**
 * Computes the intent hash for a MultiPayload locally, without needing to publish it.
 * This follows the same logic as the NEAR intents repository:
 * https://github.com/near/intents/blob/11fe297dddd50936b297485e147548f5f9a69200/core/src/payload/multi.rs#L56
 *
 * @param multiPayload The signed multi-payload for which to compute the hash
 * @returns The intent hash as a base58-encoded string
 */
export async function computeIntentHash(
	multiPayload: MultiPayload,
): Promise<IntentHash> {
	const hashBytes = await computeIntentHashBytes(multiPayload);
	return base58.encode(hashBytes);
}

/**
 * Computes the intent hash bytes for a MultiPayload.
 * Different standards use different hashing algorithms.
 *
 * @param multiPayload The signed multi-payload for which to compute the hash
 * @returns The intent hash as bytes
 */
export async function computeIntentHashBytes(
	multiPayload: MultiPayload,
): Promise<Uint8Array> {
	switch (multiPayload.standard) {
		case "nep413":
			return computeNep413Hash(
				multiPayload as Extract<MultiPayload, { standard: "nep413" }>,
			);

		case "erc191":
		case "tip191":
			return computeErc191Hash(
				multiPayload as Extract<
					MultiPayload,
					{ standard: "erc191" | "tip191" }
				>,
			);

		default:
			throw new Error(
				`Standard is not yet supported: ${multiPayload.standard}`,
			);
	}
}

async function computeNep413Hash(
	multiPayload: Pick<Extract<MultiPayload, { standard: "nep413" }>, "payload">,
): Promise<Uint8Array> {
	// For NEP-413, we need to reconstruct the original message that was hashed
	const payload = multiPayload.payload;

	return hashNEP413Message({
		message: payload.message,
		recipient: payload.recipient,
		nonce: Array.from(base64.decode(payload.nonce)),
		callback_url: payload.callbackUrl,
	});
}

function computeErc191Hash(
	multiPayload: Pick<
		Extract<MultiPayload, { standard: "erc191" | "tip191" }>,
		"payload"
	>,
): Uint8Array {
	// For ERC-191, the payload is the message that was signed
	const message = multiPayload.payload;

	const prefix = "\x19Ethereum Signed Message:\n";
	const messageBytes = new TextEncoder().encode(message);
	const messageWithPrefix = prefix + messageBytes.length.toString() + message;

	return keccak_256(new TextEncoder().encode(messageWithPrefix));
}

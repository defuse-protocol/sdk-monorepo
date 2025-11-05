import { sha256 } from "@noble/hashes/sha2";
import type { MultiPayload } from "@defuse-protocol/contract-types";
import { utils } from "@defuse-protocol/internal-utils";

/**
 * Compute the prehash for SEP-53 payload
 * Format: "Stellar Signed Message:\n" + message
 */
export function computeSep53Prehash(payload: string): Uint8Array {
	const prefix = new TextEncoder().encode("Stellar Signed Message:\n");
	const data = new TextEncoder().encode(payload);

	return utils.concatUint8Arrays([prefix, data]);
}

/**
 * Compute the SHA-256 hash of a SEP-53 payload
 * This is the hash that should be signed
 *
 * @param payload - The message string to hash
 * @returns 32-byte hash as Uint8Array
 */
export function computeSep53Hash(payload: string): Uint8Array {
	const prehash = computeSep53Prehash(payload);
	return sha256(prehash);
}

/**
 * Compute hash from a signed SEP-53 payload
 *
 * @param signedPayload - The signed SEP-53 payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedSep53Hash(
	signedPayload: Extract<MultiPayload, { standard: "sep53" }>,
): Uint8Array {
	return computeSep53Hash(signedPayload.payload);
}

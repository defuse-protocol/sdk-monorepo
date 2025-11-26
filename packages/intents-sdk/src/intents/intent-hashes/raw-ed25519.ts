import { sha256 } from "@noble/hashes/sha2";
import type { MultiPayload } from "@defuse-protocol/contract-types";

/**
 * Compute the SHA-256 hash of a Raw Ed25519 payload
 * This simply hashes the UTF-8 encoded payload string
 *
 * @param payload - The message string to hash
 * @returns 32-byte hash as Uint8Array
 */
export function computeRawEd25519Hash(payload: string): Uint8Array {
	const data = new TextEncoder().encode(payload);
	return sha256(data);
}

/**
 * Compute hash from a signed Raw Ed25519 payload
 *
 * @param signedPayload - The signed Raw Ed25519 payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedRawEd25519Hash(
	signedPayload: Extract<MultiPayload, { standard: "raw_ed25519" }>,
): Uint8Array {
	return computeRawEd25519Hash(signedPayload.payload);
}

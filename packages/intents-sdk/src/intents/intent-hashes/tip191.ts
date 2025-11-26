import { keccak_256 } from "@noble/hashes/sha3";
import type { MultiPayload } from "@defuse-protocol/contract-types";

/**
 * Compute the prehash for TIP-191 payload
 * Format: "\x19TRON Signed Message:\n" + length + message
 * Note: Prefix from https://tronweb.network/docu/docs/Sign%20and%20Verify%20Message/
 */
export function computeTip191Prehash(payload: string): Uint8Array {
	const data = new TextEncoder().encode(payload);
	const prefix = new TextEncoder().encode(
		`\x19TRON Signed Message:\n${data.length}`,
	);

	const result = new Uint8Array(prefix.length + data.length);
	result.set(prefix, 0);
	result.set(data, prefix.length);

	return result;
}

/**
 * Compute the Keccak256 hash of a TIP-191 payload
 * This is the hash that should be signed
 *
 * @param payload - The message string to hash
 * @returns 32-byte hash as Uint8Array
 */
export function computeTip191Hash(payload: string): Uint8Array {
	const prehash = computeTip191Prehash(payload);
	return keccak_256(prehash);
}

/**
 * Compute hash from a signed TIP-191 payload
 *
 * @param signedPayload - The signed TIP-191 payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedTip191Hash(
	signedPayload: Extract<MultiPayload, { standard: "tip191" }>,
): Uint8Array {
	return computeTip191Hash(signedPayload.payload);
}

import { keccak_256 } from "@noble/hashes/sha3";
import type { MultiPayload } from "@defuse-protocol/contract-types";

/**
 * Compute the prehash for ERC-191 payload
 * Format: "\x19Ethereum Signed Message:\n" + length + message
 */
function computeErc191Prehash(payload: string): Uint8Array {
	const data = new TextEncoder().encode(payload);
	const prefix = new TextEncoder().encode(
		`\x19Ethereum Signed Message:\n${data.length}`,
	);

	const result = new Uint8Array(prefix.length + data.length);
	result.set(prefix, 0);
	result.set(data, prefix.length);

	return result;
}

/**
 * Compute the Keccak256 hash of an ERC-191 payload
 * This is the hash that should be signed
 *
 * @param payload - The message string to hash
 * @returns 32-byte hash as Uint8Array
 */
function computeErc191Hash(payload: string): Uint8Array {
	const prehash = computeErc191Prehash(payload);
	return keccak_256(prehash);
}

/**
 * Compute hash from a signed ERC-191 payload
 *
 * @param signedPayload - The signed ERC-191 payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedErc191Hash(
	signedPayload: Extract<MultiPayload, { standard: "erc191" }>,
): Uint8Array {
	return computeErc191Hash(signedPayload.payload);
}

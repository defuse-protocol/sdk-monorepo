import { sha256 } from "@noble/hashes/sha2";
import type { MultiPayload } from "@defuse-protocol/contract-types";

/**
 * Compute the SHA-256 hash of a WebAuthn payload
 * This simply hashes the UTF-8 encoded payload string
 *
 * @param payload - The message string to hash
 * @returns 32-byte hash as Uint8Array
 */
export function computeWebAuthnHash(payload: string): Uint8Array {
	const data = new TextEncoder().encode(payload);
	return sha256(data);
}

/**
 * Compute hash from a signed WebAuthn payload
 *
 * @param signedPayload - The signed WebAuthn payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedWebAuthnHash(
	signedPayload: Extract<MultiPayload, { standard: "webauthn" }>,
): Uint8Array {
	return computeWebAuthnHash(signedPayload.payload);
}

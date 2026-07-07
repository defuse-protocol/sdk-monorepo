import { sha256 } from "@noble/hashes/sha2";
import type { MultiPayload } from "@defuse-protocol/contract-types";
import { tryParseTonAddress } from "../../lib/ton-address";

export interface TonAddress {
	workchainId: number; // i32: typically 0 for base workchain, -1 for masterchain
	address: Uint8Array; // 32 bytes
}

/**
 * Convert number to big-endian byte array
 */
function numberToBigEndian(num: number, bytes: number): Uint8Array {
	const result = new Uint8Array(bytes);
	for (let i = bytes - 1; i >= 0; i--) {
		result[i] = num & 0xff;
		num >>= 8;
	}
	return result;
}

export function parseTonAddress(addressString: string): TonAddress {
	const parsed = tryParseTonAddress(addressString);
	if (parsed === null) {
		throw new Error(`Invalid TON address: ${addressString}`);
	}
	return parsed;
}

/**
 * Compute the SHA-256 hash of a TON Connect payload
 *
 * For text and binary payloads:
 * Hash = SHA256(
 *   0xffff +
 *   "ton-connect/sign-data/" +
 *   workchain_id (4 bytes BE) +
 *   address (32 bytes) +
 *   domain_len (4 bytes BE) +
 *   domain +
 *   timestamp (8 bytes BE) +
 *   payload_type ("txt" or "bin") +
 *   payload_len (4 bytes BE) +
 *   payload
 * )
 *
 * @param payload - The TON Connect payload to hash
 * @returns 32-byte hash as Uint8Array
 */
export function computeTonConnectHash(
	payload: Extract<MultiPayload, { standard: "ton_connect" }>,
): Uint8Array {
	const { address, domain, timestamp, payload: payloadSchema } = payload;

	// Parse address if it's a string
	const parsedAddress = parseTonAddress(address);

	const schemaType = payloadSchema.type;
	switch (schemaType) {
		case "text": {
			const payloadPrefix = "txt";
			const payloadData = new TextEncoder().encode(payloadSchema.text);

			// Build the message to hash
			const parts: Uint8Array[] = [
				new Uint8Array([0xff, 0xff]),
				new TextEncoder().encode("ton-connect/sign-data/"),
				numberToBigEndian(parsedAddress.workchainId, 4),
				parsedAddress.address,
				numberToBigEndian(domain.length, 4),
				new TextEncoder().encode(domain),
				numberToBigEndian(Number(timestamp), 8),
				new TextEncoder().encode(payloadPrefix),
				numberToBigEndian(payloadData.length, 4),
				payloadData,
			];

			// Concatenate all parts
			const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
			const message = new Uint8Array(totalLength);
			let offset = 0;
			for (const part of parts) {
				message.set(part, offset);
				offset += part.length;
			}

			return sha256(message);
		}
		default: {
			schemaType satisfies never;
			throw new Error(`Unknown TON Connect payload type: ${schemaType}`);
		}
	}
}

/**
 * Compute hash from a signed TON Connect payload
 *
 * @param signedPayload - The signed TON Connect payload
 * @returns 32-byte hash as Uint8Array
 */
export function computeSignedTonConnectHash(
	signedPayload: Extract<MultiPayload, { standard: "ton_connect" }>,
): Uint8Array {
	return computeTonConnectHash(signedPayload);
}

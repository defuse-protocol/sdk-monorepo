import { sha256 } from "@noble/hashes/sha2";
import type { MultiPayload } from "@defuse-protocol/contract-types";

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

/**
 * Parse TON address string to TonAddress object
 * Supports raw format: "workchain:address_hex"
 * Example: "0:f4809e5ffac9dc42a6b1d94c5e74ad5fd86378de675c805f2274d0055cbc9378"
 *
 * @param addressString - TON address string in raw format
 * @returns Parsed TonAddress object
 */
export function parseTonAddress(addressString: string): TonAddress {
	const parts = addressString.split(":");
	if (parts.length !== 2) {
		throw new Error(
			`Invalid TON address format: ${addressString}. Expected "workchain:address_hex"`,
		);
	}

	// biome-ignore lint/style/noNonNullAssertion: split by ":" guarantees two parts after length check
	const workchainId = parseInt(parts[0]!, 10);
	if (Number.isNaN(workchainId)) {
		throw new Error(`Invalid workchain ID: ${parts[0]}`);
	}

	// Remove any 0x prefix if present
	// biome-ignore lint/style/noNonNullAssertion: split by ":" guarantees two parts after length check
	const addressHex = parts[1]!.startsWith("0x") ? parts[1]!.slice(2) : parts[1];

	// biome-ignore lint/style/noNonNullAssertion: addressHex is assigned above
	if (addressHex!.length !== 64) {
		throw new Error(
			// biome-ignore lint/style/noNonNullAssertion: addressHex is assigned above
			`Invalid address length: expected 64 hex characters, got ${addressHex!.length}`,
		);
	}

	// Convert hex string to bytes
	const address = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		// biome-ignore lint/style/noNonNullAssertion: length validated above
		address[i] = parseInt(addressHex!.slice(i * 2, i * 2 + 2), 16);
	}

	return { workchainId, address };
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
 * For cell payloads: Uses TON TLB message serialization (not fully implemented here)
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
		case "binary": {
			throw new Error("Binary payload hashing is not yet supported");
		}
		case "cell": {
			throw new Error("Cell payload hashing is not yet supported.");
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

import { base64 } from "@scure/base";
import { deserialize } from "near-api-js/lib/utils/serialize";
import type { Schema } from "near-api-js/lib/utils/serialize";
import * as v from "valibot";

//  Magic prefix (first 4 bytes of `sha256(<versioned_nonce>)`) used to mark versioned nonces
export const VERSIONED_MAGIC_PREFIX = new Uint8Array([0x56, 0x28, 0xf6, 0xc6]);
export const LATEST_VERSION = 0;

export type Salt = Uint8Array;

/**
 * Schema for validating decoded salted nonce structure.
 * The decoded value from `VersionedNonceBuilder.decodeNonce()` should match this structure.
 */
export const saltedNonceSchema = v.object({
	salt: v.array(v.number()),
	inner: v.object({
		deadline: v.bigint(),
		nonce: v.array(v.number()),
	}),
});

export type SaltedNonceValue = v.InferOutput<typeof saltedNonceSchema>;

class ExpirableNonce {
	constructor(
		public deadline: bigint,
		public nonce: Uint8Array,
	) {
		if (nonce.length !== 15) {
			throw new Error("Random nonce part must be exactly 15 bytes");
		}
	}
}

class SaltedNonce {
	constructor(
		public salt: Salt,
		public inner: ExpirableNonce,
	) {}
}

/**
 * VersionedNonce class representing a versioned expirable nonce
 *
 * @property version The version of the nonce
 * @property value The current value of nonce, it is unknown to allow for future version types
 */
class VersionedNonce {
	constructor(
		public version: number,
		public value: unknown,
	) {}

	static latest(saltedNonce: SaltedNonce): VersionedNonce {
		return new VersionedNonce(LATEST_VERSION, saltedNonce);
	}
}

export const SALTED_NONCE_BORSH_SCHEMA: Schema = {
	struct: {
		salt: { array: { type: "u8", len: 4 } },
		inner: {
			struct: {
				deadline: "u64",
				nonce: { array: { type: "u8", len: 15 } },
			},
		},
	},
};

export namespace VersionedNonceBuilder {
	const RANDOM_BYTES_LENGTH = 15;

	/**
	 * Creates nonce bytes with embedded start timestamp.
	 * Layout: [startTime: 8 bytes LE nanoseconds] [random: 7 bytes]
	 *
	 * @param startTime The start time to embed in the nonce
	 * @returns 15-byte Uint8Array with timestamp and random data
	 */
	export function createTimestampedNonceBytes(startTime: Date): Uint8Array {
		const bytes = new Uint8Array(RANDOM_BYTES_LENGTH);
		const view = new DataView(bytes.buffer);
		view.setBigInt64(0, BigInt(startTime.getTime()) * 1_000_000n, true);
		crypto.getRandomValues(bytes.subarray(8));
		return bytes;
	}

	/**
	 * Encodes a versioned expirable nonce with the given salt and deadline
	 *
	 * @param salt The salt to use for the nonce
	 * @param deadline The expiration deadline for the nonce
	 * @param randomBytes Optional random bytes to use. If not provided, random bytes will be generated.
	 * @returns The encoded nonce as a base64 string
	 */
	export function encodeNonce(
		salt: Salt,
		deadline: Date,
		randomBytes: Uint8Array<ArrayBufferLike> = crypto.getRandomValues(
			new Uint8Array(RANDOM_BYTES_LENGTH),
		),
	): string {
		if (salt.length !== 4) {
			throw new Error(`Invalid salt length: ${salt.length}, expected 4`);
		}
		if (randomBytes.length !== RANDOM_BYTES_LENGTH) {
			throw new Error(
				`Invalid randomBytes length: ${randomBytes.length}, expected ${RANDOM_BYTES_LENGTH}`,
			);
		}

		const deadlineBigInt = BigInt(deadline.getTime()) * 1_000_000n;

		// Manual serialization of SaltedNonce
		// salt (4) + deadline (8) + nonce (15) = 27 bytes
		const borshBytes = new Uint8Array(27);

		// Salt
		borshBytes.set(salt, 0);

		// Deadline (u64 little endian)
		const view = new DataView(
			borshBytes.buffer,
			borshBytes.byteOffset,
			borshBytes.byteLength,
		);
		view.setBigUint64(4, deadlineBigInt, true);

		// Random bytes
		borshBytes.set(randomBytes, 12);

		// Serializing in full format: MAGIC_PREFIX (4) | VERSION (1) | NONCE_BYTES (27)
		const result = new Uint8Array(4 + 1 + borshBytes.length);
		result.set(VERSIONED_MAGIC_PREFIX, 0);
		result.set([LATEST_VERSION], 4);
		result.set(borshBytes, 5);

		return base64.encode(result);
	}

	/**
	 * Decodes a versioned expirable nonce from a base64-encoded string
	 *
	 * @param encoded The encoded nonce string
	 * @returns The decoded VersionedNonce object
	 */
	export function decodeNonce(encoded: string): VersionedNonce {
		const bytes = base64.decode(encoded);

		if (bytes.length !== 32) {
			throw new Error("Nonce too short");
		}

		const prefix = bytes.slice(0, 4);
		const version = bytes[4] as number;
		const borshData = bytes.slice(5);

		// Check magic prefix
		if (!prefix.every((byte, i) => byte === VERSIONED_MAGIC_PREFIX[i])) {
			throw new Error("Invalid magic prefix");
		}

		const value = deserialize(SALTED_NONCE_BORSH_SCHEMA, borshData);

		return new VersionedNonce(version, value);
	}
}

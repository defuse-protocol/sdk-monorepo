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

const SALTED_NONCE_BORSH_SCHEMA: Schema = {
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
	/**
	 * Encodes a versioned expirable nonce with the given salt and deadline
	 *
	 * @param salt The salt to use for the nonce
	 * @param deadline The expiration deadline for the nonce
	 * @returns The encoded nonce as a base64 string
	 */
	export function encodeNonce(salt: Salt, deadline: Date): string {
		if (salt.length !== 4) {
			throw new Error(`Invalid salt length: ${salt.length}, expected 4`);
		}

		const deadlineBigInt = BigInt(deadline.getTime()) * 1_000_000n;
		const nonceBytes = crypto.getRandomValues(new Uint8Array(15));

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

		// Nonce
		borshBytes.set(nonceBytes, 12);

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

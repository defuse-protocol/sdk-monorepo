import { base64 } from "@scure/base";
import { serialize, deserialize } from "near-api-js/lib/utils/serialize";
import type { Schema } from "near-api-js/lib/utils/serialize";

//  Magic prefix (first 4 bytes of `sha256(<versioned_nonce>)`) used to mark versioned nonces
export const VERSIONED_MAGIC_PREFIX = new Uint8Array([0x56, 0x28, 0xf6, 0xc6]);
export const LATEST_VERSION = 1;

export type Salt = number;

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

class VersionedNonce {
	constructor(
		public version: number,
		public value: any,
	) {}

	static latest(saltedNonce: SaltedNonce): VersionedNonce {
		return new VersionedNonce(LATEST_VERSION, saltedNonce);
	}

	isExpired(time: Date = new Date()): boolean {
		const nowNs = BigInt(time.getTime()) * 1_000_000n;
		return this.value.inner.deadline <= nowNs;
	}
}

const SALTED_NONCE_BORSH_SCHEMA: Schema = {
	struct: {
		salt: "u32",
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
		const expirableNonce = {
			deadline: BigInt(deadline.getTime()) * 1_000_000n,
			nonce: crypto.getRandomValues(new Uint8Array(15)),
		};

		let versionedNonce = VersionedNonce.latest(
			new SaltedNonce(salt, expirableNonce),
		);

		const borshBytes = serialize(
			SALTED_NONCE_BORSH_SCHEMA,
			versionedNonce.value,
		);

		// Serializing in full format: MAGIC_PREFIX (4) | VERSION (1) | NONCE_BYTES (27)
		const result = new Uint8Array(4 + 1 + borshBytes.length);
		result.set(VERSIONED_MAGIC_PREFIX, 0);
		result.set([versionedNonce.version], 4);
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

		if (bytes.length != 32) {
			throw new Error("Nonce too short");
		}

		// Check magic prefix
		const prefix = bytes.slice(0, 4);
		if (!(prefix.toString() === VERSIONED_MAGIC_PREFIX.toString())) {
			throw new Error("Invalid magic prefix");
		}

		// Check version
		const version = bytes[4];
		if (version !== LATEST_VERSION) {
			throw new Error(`Unsupported version: ${version}`);
		}

		const borshData = bytes.slice(5);
		let value = deserialize(
			SALTED_NONCE_BORSH_SCHEMA,
			borshData,
		) as SaltedNonce;

		return new VersionedNonce(version, value);
	}
}

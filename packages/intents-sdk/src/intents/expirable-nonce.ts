import { base64 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";

const EXPIRABLE_NONCE_PREFIX_BYTESIZE = 4;
export const EXPIRABLE_NONCE_PREFIX = sha256("expirable_nonce").subarray(
	0,
	EXPIRABLE_NONCE_PREFIX_BYTESIZE,
);

export interface ExpirableNonce {
	// Deadline in nanoseconds
	deadline: bigint;
	// 20 bytes random nonce
	nonce: Uint8Array;
}

export function generateExpirableNonce(deadline: Date): ExpirableNonce {
	return {
		deadline: BigInt(deadline.getTime()) * 1_000_000n,
		nonce: crypto.getRandomValues(new Uint8Array(20)),
	};
}

export function encodeNonce(nonce: ExpirableNonce): string {
	const result = new Uint8Array(32);

	result.set(EXPIRABLE_NONCE_PREFIX, 0);
	new DataView(result.buffer).setBigUint64(
		EXPIRABLE_NONCE_PREFIX_BYTESIZE,
		nonce.deadline,
		false,
	);
	result.set(nonce.nonce, EXPIRABLE_NONCE_PREFIX_BYTESIZE + 8);

	return base64.encode(result);
}

export function decodeNonce(encoded: string): ExpirableNonce {
	const bytes = base64.decode(encoded);
	if (bytes.length !== 32) {
		throw new Error("Invalid expirable nonce: incorrect length");
	}
	for (let i = 0; i < EXPIRABLE_NONCE_PREFIX_BYTESIZE; i++) {
		if (bytes[i] !== EXPIRABLE_NONCE_PREFIX[i]) {
			throw new Error("Invalid expirable nonce: wrong prefix");
		}
	}
	const deadline = new DataView(bytes.buffer).getBigUint64(
		EXPIRABLE_NONCE_PREFIX_BYTESIZE,
		false,
	);
	const nonce = bytes.slice(EXPIRABLE_NONCE_PREFIX_BYTESIZE + 8);
	return { deadline, nonce };
}

export function isNonceExpired(
	nonce: ExpirableNonce,
	now: Date = new Date(),
): boolean {
	const nowNs = BigInt(now.getTime()) * 1_000_000n;
	return nowNs >= nonce.deadline;
}

export function buildAndEncodeExpirableNonce(deadline: Date): string {
	return encodeNonce(generateExpirableNonce(deadline));
}

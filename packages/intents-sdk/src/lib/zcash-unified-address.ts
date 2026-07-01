/**
 * Zcash Unified Address (ZIP 316) validation.
 *
 * Reference implementation used to cross-check this code:
 *   - crate:  `zcash_address`  https://crates.io/crates/zcash_address
 *   - crate:  `f4jumble`       https://crates.io/crates/f4jumble
 *   - source: https://github.com/zcash/librustzcash/tree/main/components/zcash_address
 *             https://github.com/zcash/librustzcash/tree/main/components/f4jumble
 *
 * Spec: https://zips.z.cash/zip-0316
 */

import { blake2b } from "@noble/hashes/blake2";
import { bech32m } from "@scure/base";

const ZCASH_UA_MAINNET_HRP = "u";

// ZIP 316 F4Jumble parameters.
// Matches librustzcash: `VALID_LENGTH: RangeInclusive<usize> = 48..=4194368`
// https://github.com/zcash/librustzcash/blob/main/components/f4jumble/src/lib.rs
const F4_MIN_LEN = 48;
const F4_MAX_LEN = 4194368;
const F4_BLAKE2B_LEN = 64; // ℓ_H — BLAKE2b output size in bytes

// 13-byte ASCII personalization prefixes; the remaining 3 bytes encode round `i` and block `j`.
// See H_PERS! / G_PERS! macros in librustzcash/components/f4jumble/src/lib.rs.
const G_PREFIX = asciiBytes("UA_F4Jumble_G");
const H_PREFIX = asciiBytes("UA_F4Jumble_H");

const RECEIVER_TYPECODE = {
	P2PKH: 0x00,
	P2SH: 0x01,
	SAPLING: 0x02,
	ORCHARD: 0x03,
} as const;

// Canonical receiver payload lengths for known typecodes. Unknown typecodes are
// tolerated with arbitrary lengths for forward compatibility, matching
// `Typecode::Unknown` handling in librustzcash/components/zcash_address.
const KNOWN_RECEIVER_LENGTH: Record<number, number> = {
	[RECEIVER_TYPECODE.P2PKH]: 20,
	[RECEIVER_TYPECODE.P2SH]: 20,
	[RECEIVER_TYPECODE.SAPLING]: 43,
	[RECEIVER_TYPECODE.ORCHARD]: 43,
};

/**
 * Validates a Zcash Unified Address (ZIP 316) and requires that it contains
 * at least one Orchard, P2PKH, or P2SH receiver. Sapling-only UAs are rejected.
 *
 * The parse pipeline (bech32m → F4Jumble⁻¹ → padding check → receiver list)
 * mirrors `Encoding::parse_items` in
 * https://github.com/zcash/librustzcash/blob/main/components/zcash_address/src/kind/unified.rs
 */
export function validateZcashUnifiedAddress(address: string): boolean {
	try {
		const decoded = bech32m.decodeToBytes(address);
		if (decoded.prefix !== ZCASH_UA_MAINNET_HRP) return false;

		const payload = decoded.bytes;
		if (payload.length < F4_MIN_LEN || payload.length > F4_MAX_LEN) {
			return false;
		}

		const unjumbled = f4JumbleInverse(payload);

		// Padding is the last 16 bytes: HRP followed by zeros.
		const paddingLen = 16;
		if (unjumbled.length <= paddingLen) return false;
		const paddingStart = unjumbled.length - paddingLen;

		if (unjumbled[paddingStart] !== ZCASH_UA_MAINNET_HRP.charCodeAt(0)) {
			return false;
		}
		for (let i = paddingStart + 1; i < unjumbled.length; i++) {
			if (unjumbled[i] !== 0) return false;
		}

		let offset = 0;
		let lastTypecode = -1;
		let hasOrchardOrTransparent = false;

		while (offset < paddingStart) {
			const typeRead = readCompactSize(unjumbled, offset, paddingStart);
			if (typeRead === null) return false;
			const typecode = typeRead.value;
			offset = typeRead.next;

			// ZIP 316: typecodes must be strictly ascending.
			if (typecode <= lastTypecode) return false;
			lastTypecode = typecode;

			const lenRead = readCompactSize(unjumbled, offset, paddingStart);
			if (lenRead === null) return false;
			const len = lenRead.value;
			offset = lenRead.next;

			if (len === 0) return false;
			if (offset + len > paddingStart) return false;

			const expectedLen = KNOWN_RECEIVER_LENGTH[typecode];
			if (expectedLen !== undefined && len !== expectedLen) return false;

			if (
				typecode === RECEIVER_TYPECODE.P2PKH ||
				typecode === RECEIVER_TYPECODE.P2SH ||
				typecode === RECEIVER_TYPECODE.ORCHARD
			) {
				hasOrchardOrTransparent = true;
			}

			offset += len;
		}

		if (offset !== paddingStart) return false;

		return hasOrchardOrTransparent;
	} catch {
		return false;
	}
}

/**
 * Bitcoin-style CompactSize decoder, canonical form only.
 * Reference: `CompactSize::read` in
 * https://github.com/zcash/librustzcash/blob/main/components/zcash_encoding/src/lib.rs
 */
function readCompactSize(
	buf: Uint8Array,
	offset: number,
	end: number,
): { value: number; next: number } | null {
	if (offset >= end) return null;
	const first = buf[offset] as number;
	if (first < 0xfd) return { value: first, next: offset + 1 };
	if (first === 0xfd) {
		if (offset + 3 > end) return null;
		const value =
			(buf[offset + 1] as number) | ((buf[offset + 2] as number) << 8);
		if (value < 0xfd) return null;
		return { value, next: offset + 3 };
	}
	if (first === 0xfe) {
		if (offset + 5 > end) return null;
		const value =
			((buf[offset + 1] as number) |
				((buf[offset + 2] as number) << 8) |
				((buf[offset + 3] as number) << 16) |
				((buf[offset + 4] as number) << 24)) >>>
			0;
		if (value <= 0xffff) return null;
		return { value, next: offset + 5 };
	}
	// 0xff would require an 8-byte value; no legitimate receiver field is that large.
	return null;
}

/**
 * Inverse of ZIP 316 F4Jumble: a 4-round unkeyed Feistel over BLAKE2b.
 * Forward:  x = b ⊕ G_0(a);  y = a ⊕ H_0(x);  d = x ⊕ G_1(y);  c = y ⊕ H_1(d)
 * Inverse undoes each XOR in reverse order.
 *
 * Reference: `State::apply_f4jumble_inv` in
 * https://github.com/zcash/librustzcash/blob/main/components/f4jumble/src/lib.rs
 */
function f4JumbleInverse(msg: Uint8Array): Uint8Array {
	const len = msg.length;
	// ℓ_L = min(ℓ_H, floor(ℓ_M / 2))
	const lLen = Math.min(F4_BLAKE2B_LEN, Math.floor(len / 2));
	const rLen = len - lLen;

	const left = msg.slice(0, lLen); // starts as c
	const right = msg.slice(lLen); // starts as d

	xorInto(left, hI(1, right, lLen)); // left := y
	xorInto(right, gI(1, left, rLen)); // right := x
	xorInto(left, hI(0, right, lLen)); // left := a
	xorInto(right, gI(0, left, rLen)); // right := b

	const out = new Uint8Array(len);
	out.set(left, 0);
	out.set(right, lLen);
	return out;
}

// H_i(u) = BLAKE2b-(8·ℓ_L)( personalization = "UA_F4Jumble_H" || [i, 0, 0], u )
// Reference: `State::h_round` in librustzcash/components/f4jumble/src/lib.rs
function hI(i: number, u: Uint8Array, lLen: number): Uint8Array {
	return blake2b(u, {
		personalization: buildPersonalization(H_PREFIX, i, 0),
		dkLen: lLen,
	});
}

// G_i(u) = first ℓ_R bytes of concat[ BLAKE2b-512(personalization=..._G || [i] || LE16(j), u) ]
// Reference: `State::g_round` in librustzcash/components/f4jumble/src/lib.rs
function gI(i: number, u: Uint8Array, rLen: number): Uint8Array {
	const chunks = Math.ceil(rLen / F4_BLAKE2B_LEN);
	const out = new Uint8Array(chunks * F4_BLAKE2B_LEN);
	for (let j = 0; j < chunks; j++) {
		const digest = blake2b(u, {
			personalization: buildPersonalization(G_PREFIX, i, j),
			dkLen: F4_BLAKE2B_LEN,
		});
		out.set(digest, j * F4_BLAKE2B_LEN);
	}
	return out.subarray(0, rLen);
}

function buildPersonalization(
	prefix: Uint8Array,
	i: number,
	j: number,
): Uint8Array {
	const p = new Uint8Array(16);
	p.set(prefix, 0);
	p[13] = i & 0xff;
	p[14] = j & 0xff;
	p[15] = (j >> 8) & 0xff;
	return p;
}

function asciiBytes(s: string): Uint8Array {
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

function xorInto(target: Uint8Array, other: Uint8Array): void {
	for (let i = 0; i < target.length; i++) {
		target[i] = (target[i] as number) ^ (other[i] as number);
	}
}

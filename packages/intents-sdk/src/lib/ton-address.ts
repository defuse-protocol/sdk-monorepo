import { base64urlnopad } from "@scure/base";

/**
 * Tag byte for user-friendly TON addresses. Bit 7 sets testnet, bit 6 sets
 * non-bounceable. See https://docs.ton.org/learn/overviews/addresses#user-friendly-address
 */
export const TON_ADDRESS_TAG_BOUNCEABLE_MAINNET = 0x11;
export const TON_ADDRESS_TAG_NON_BOUNCEABLE_MAINNET = 0x51;
export const TON_ADDRESS_TAG_BOUNCEABLE_TESTNET = 0x91;
export const TON_ADDRESS_TAG_NON_BOUNCEABLE_TESTNET = 0xd1;

/**
 * Real TON only uses these two workchains. Other values parse fine but no
 * wallet emits them, so the validator treats them as typos.
 */
export const TON_WORKCHAIN_BASECHAIN = 0;
export const TON_WORKCHAIN_MASTERCHAIN = -1;

const TON_USER_FRIENDLY_LENGTH = 36;

export function crc16ccitt(data: Uint8Array): [number, number] {
	let crc = 0x0000;
	for (const byte of data) {
		crc ^= byte << 8;
		for (let i = 0; i < 8; i++) {
			crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
		}
		crc &= 0xffff;
	}
	return [(crc >> 8) & 0xff, crc & 0xff];
}

export interface ParsedTonUserFriendlyAddress {
	tag: number;
	workchainId: number; // i32, sign-extended from the i8 in byte 1
	address: Uint8Array; // 32 bytes
}

// Exposes the tag byte instead of enforcing it. The hash uses only
// (workchain, address), so callers decide what tags to accept: validation
// rejects testnet, hashing accepts any.
export function parseTonUserFriendlyAddress(
	s: string,
): ParsedTonUserFriendlyAddress | null {
	// Accept both URL-safe and standard base64. Wallets emit either form, and
	// @ton/core does the same swap.
	const normalized = s.replace(/\+/g, "-").replace(/\//g, "_");
	let data: Uint8Array;
	try {
		data = base64urlnopad.decode(normalized);
	} catch {
		return null;
	}
	if (data.length !== TON_USER_FRIENDLY_LENGTH) return null;

	const [hi, lo] = crc16ccitt(data.subarray(0, 34));
	if (data[34] !== hi || data[35] !== lo) return null;

	// biome-ignore lint/style/noNonNullAssertion: length checked above
	const tag = data[0]!;
	// biome-ignore lint/style/noNonNullAssertion: length checked above
	const wcByte = data[1]!;
	// Sign-extend i8 → i32: 0xff → -1 (masterchain), 0x00 → 0 (basechain).
	const workchainId = wcByte > 0x7f ? wcByte - 0x100 : wcByte;
	const address = data.slice(2, 34);

	return { tag, workchainId, address };
}

export interface ParsedTonAddress {
	workchainId: number;
	address: Uint8Array; // 32 bytes
	/**
	 * Tag byte from the user-friendly form (e.g. 0x11/0x51 mainnet, 0x91/0xD1
	 * testnet). Null for raw form, which has no tag byte.
	 */
	tag: number | null;
}

const RAW_HEX_LENGTH = 64;

// Format: "<workchain>:<64-hex>". Workchain can be any signed int (same as
// @ton/core's Address.isRaw). Tolerates a leading "0x" on the hex.
export function parseTonRawAddress(s: string): ParsedTonAddress | null {
	const parts = s.split(":");
	if (parts.length !== 2) return null;

	// biome-ignore lint/style/noNonNullAssertion: split length checked above
	const workchainId = parseInt(parts[0]!, 10);
	if (Number.isNaN(workchainId)) return null;

	// biome-ignore lint/style/noNonNullAssertion: split length checked above
	let hex = parts[1]!;
	if (hex.startsWith("0x")) hex = hex.slice(2);
	if (hex.length !== RAW_HEX_LENGTH) return null;
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

	const address = new Uint8Array(32);
	for (let i = 0; i < 32; i++) {
		address[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return { workchainId, address, tag: null };
}

// Dispatching on ":" is safe: raw form always has one, user-friendly form is
// base64url and never does.
export function tryParseTonAddress(s: string): ParsedTonAddress | null {
	if (s.includes(":")) return parseTonRawAddress(s);
	return parseTonUserFriendlyAddress(s);
}

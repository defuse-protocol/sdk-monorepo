import { sha256 } from "@noble/hashes/sha2";
import { base58, bech32m, hex, bech32 } from "@scure/base";
import { PublicKey } from "@solana/web3.js";
import {
	isValidClassicAddress as xrp_isValidClassicAddress,
	isValidXAddress as xrp_isValidXAddress,
} from "ripple-address-codec";
import { Chains, type Chain } from "./caip2";
import { isAddress } from "viem";
import { utils } from "@defuse-protocol/internal-utils";

/**
 * Validates that an address matches the expected format for a given blockchain.
 *
 * Note: This validates address FORMAT only. Specific bridges may have
 * additional requirements (e.g., supported address types, memo requirements).
 * A valid format does not guarantee a bridge will accept the address.
 */
export function validateAddress(address: string, blockchain: Chain): boolean {
	switch (blockchain) {
		case Chains.Near:
			return utils.validateNearAddress(address);

		case Chains.Bitcoin:
			return validateBtcAddress(address);

		case Chains.BitcoinCash:
			return validateBchAddress(address);

		case Chains.Solana:
			return validateSolAddress(address);

		case Chains.Dogecoin:
			return validateDogeAddress(address);

		case Chains.Litecoin:
			return validateLitecoinAddress(address);

		case Chains.XRPL:
			return validateXrpAddress(address);

		case Chains.Zcash:
			return validateZcashAddress(address);

		case Chains.Tron:
			return validateTronAddress(address);

		case Chains.TON:
			return validateTonAddress(address);

		case Chains.Sui:
			return validateSuiAddress(address);

		case Chains.Stellar:
			return validateStellarAddress(address);

		case Chains.Aptos:
			return validateAptosAddress(address);

		case Chains.Cardano:
			return validateCardanoAddress(address);

		case Chains.Starknet:
			return validateStarknetAddress(address);

		case Chains.Ethereum:
		case Chains.Optimism:
		case Chains.BNB:
		case Chains.Gnosis:
		case Chains.Polygon:
		case Chains.Monad:
		case Chains.LayerX:
		case Chains.Adi:
		case Chains.Base:
		case Chains.Arbitrum:
		case Chains.Avalanche:
		case Chains.Berachain:
		case Chains.Plasma:
		case Chains.Scroll:
			return validateEthAddress(address);
		case Chains.Aleo:
			return validateAleoAddress(address);
		default:
			blockchain satisfies never;
			return false;
	}
}

function validateEthAddress(address: string) {
	return isAddress(address, { strict: true });
}

function validateBtcAddress(address: string) {
	// Check Taproot (bc1p...) BEFORE generic SegWit (bc1q...)
	// to avoid bc1p being matched by the broader bc1 pattern
	if (/^bc1p[02-9ac-hj-np-z]{42,87}$/.test(address)) {
		return validateBtcBech32mAddress(address);
	}

	// Bech32 SegWit v0 (bc1q...) - use specific bc1q pattern
	if (/^bc1q[02-9ac-hj-np-z]{11,87}$/.test(address)) {
		return validateBtcBech32Address(address);
	}

	// P2PKH (1...) - requires Base58Check validation
	if (/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
		return validateBtcBase58Address(address, 0x00);
	}

	// P2SH (3...) - requires Base58Check validation
	if (/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)) {
		return validateBtcBase58Address(address, 0x05);
	}

	return false;
}

/**
 * Validates Bitcoin Base58Check addresses (P2PKH and P2SH)
 * Verifies the double SHA-256 checksum to prevent typos and transcription errors
 */
function validateBtcBase58Address(
	address: string,
	expectedVersion: number,
): boolean {
	try {
		const decoded = base58.decode(address);

		// version (1) + payload (20) + checksum (4) = 25 bytes
		if (decoded.length !== 25) return false;

		const version = decoded[0];
		if (version !== expectedVersion) return false;

		const payload = decoded.subarray(0, 21); // version + hash160
		const checksum = decoded.subarray(21, 25);

		// Calculate expected checksum: double SHA-256 of payload
		const hash1 = sha256(payload);
		const hash2 = sha256(hash1);
		const expectedChecksum = hash2.subarray(0, 4);

		// Compare checksums
		for (let i = 0; i < 4; i++) {
			if (checksum[i] !== expectedChecksum[i]) return false;
		}

		return true;
	} catch {
		return false;
	}
}

/**
 * Validates Bitcoin Bech32 addresses (SegWit v0)
 */
function validateBtcBech32Address(address: string): boolean {
	try {
		const decoded = bech32.decode(address as `${string}1${string}`);
		if (decoded.prefix !== "bc") return false;

		const { words } = decoded;
		if (!words || words.length < 1) return false;

		const version = words[0];
		if (version !== 0) return false;

		const program = bech32.fromWords(words.slice(1));
		// SegWit v0: 20 bytes (P2WPKH) or 32 bytes (P2WSH)
		return program.length === 20 || program.length === 32;
	} catch {
		return false;
	}
}

/**
 * Validates Bitcoin Bech32m addresses (Taproot)
 */
function validateBtcBech32mAddress(address: string): boolean {
	try {
		const decoded = bech32m.decode(address as `${string}1${string}`);
		if (decoded.prefix !== "bc") return false;

		const { words } = decoded;
		if (!words || words.length < 1) return false;

		const version = words[0];
		if (version !== 1) return false; // Taproot is version 1

		const program = bech32m.fromWords(words.slice(1));
		// Taproot: 32 bytes
		return program.length === 32;
	} catch {
		return false;
	}
}

/**
 * Validates Bitcoin Cash addresses
 * Supports:
 * - Legacy addresses (1... for P2PKH, 3... for P2SH) - shared with Bitcoin
 * - CashAddr format (bitcoincash:q... or q... for P2PKH, bitcoincash:p... or p... for P2SH)
 *
 * CashAddr checksum implementation based on:
 * @see https://github.com/ealmansi/cashaddrjs (MIT License)
 * @see https://github.com/bitcoincashorg/bitcoincash.org/blob/master/spec/cashaddr.md
 */
export function validateBchAddress(address: string): boolean {
	// Legacy address format (same as Bitcoin)
	if (
		/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) ||
		/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address)
	) {
		return true;
	}

	// CashAddr format
	return validateBchCashAddr(address);
}

/**
 * Validates Bitcoin Cash CashAddr format
 * CashAddr uses a modified Bech32 encoding with polymod checksum
 */
function validateBchCashAddr(address: string): boolean {
	// Normalize the address
	let normalized = address.toLowerCase();

	// Add prefix if missing
	if (!normalized.includes(":")) {
		normalized = `bitcoincash:${normalized}`;
	}

	// Must start with bitcoincash:
	if (!normalized.startsWith("bitcoincash:")) {
		return false;
	}

	const payload = normalized.slice("bitcoincash:".length);

	// Must start with q (P2PKH) or p (P2SH)
	if (!payload.startsWith("q") && !payload.startsWith("p")) {
		return false;
	}

	// CashAddr charset (excludes 1, b, i, o)
	const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

	// Check all characters are valid
	for (const char of payload) {
		if (!CHARSET.includes(char)) {
			return false;
		}
	}

	// Verify length: 42 chars for 160-bit hash (P2PKH/P2SH), 61 for 256-bit
	if (payload.length !== 42 && payload.length !== 61) {
		return false;
	}

	// Verify checksum using BCH polymod
	return verifyBchChecksum(normalized);
}

function verifyBchChecksum(address: string): boolean {
	const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

	// Split prefix and payload
	const colonIndex = address.indexOf(":");
	const prefix = address.slice(0, colonIndex);
	const payload = address.slice(colonIndex + 1);

	// Expand prefix for checksum (each character's lower 5 bits)
	const prefixData: number[] = [];
	for (const char of prefix) {
		prefixData.push(char.charCodeAt(0) & 0x1f);
	}
	prefixData.push(0); // separator

	// Convert payload to 5-bit values
	const payloadData: number[] = [];
	for (const char of payload) {
		const idx = CHARSET.indexOf(char);
		if (idx === -1) return false;
		payloadData.push(idx);
	}

	const values = [...prefixData, ...payloadData];

	// BCH polymod calculation
	let c = 1n;
	for (const d of values) {
		const c0 = c >> 35n;
		c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
		if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
		if (c0 & 0x02n) c ^= 0x79b76d99e2n;
		if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
		if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
		if (c0 & 0x10n) c ^= 0x1e4f43e470n;
	}

	// XOR with 1 and check if result is 0
	return (c ^ 1n) === 0n;
}

function validateSolAddress(address: string) {
	try {
		return PublicKey.isOnCurve(address);
	} catch {
		return false;
	}
}

function validateDogeAddress(address: string) {
	return /^[DA][1-9A-HJ-NP-Za-km-z]{25,33}$/.test(address);
}

function validateXrpAddress(address: string) {
	return xrp_isValidClassicAddress(address) || xrp_isValidXAddress(address);
}

/**
 * Validates Zcash addresses
 * Supports:
 * - Transparent addresses (t1, t3)
 * - TEX addresses (tex1)
 */
function validateZcashAddress(address: string) {
	// Transparent address validation
	if (address.startsWith("t1") || address.startsWith("t3")) {
		// t1 for P2PKH addresses, t3 for P2SH addresses
		return /^t[13][a-km-zA-HJ-NP-Z1-9]{33}$/.test(address);
	}

	// TEX address validation
	const expectedHrp = "tex";
	if (address.startsWith(`${expectedHrp}1`)) {
		try {
			const decoded = bech32m.decodeToBytes(address);
			if (decoded.prefix !== expectedHrp) {
				return false;
			}
			return decoded.bytes.length === 20;
		} catch {
			return false;
		}
	}

	// Unified address validation
	const uaHrp = "u";
	if (address.startsWith(`${uaHrp}1`)) {
		try {
			const decoded = bech32m.decodeToBytes(address);
			return decoded.prefix === uaHrp;
		} catch {
			return false;
		}
	}

	return false;
}

/**
 * Validates Tron addresses
 * Supports:
 * - hex addresses
 * - base58 addresses
 * https://developers.tron.network/docs/account
 */
function validateTronAddress(address: string): boolean {
	return validateTronBase58Address(address) || validateTronHexAddress(address);
}

function validateTronBase58Address(address: string): boolean {
	try {
		const decoded = base58.decode(address);

		if (decoded.length !== 25) return false;

		// The first 21 bytes are the address data, the last 4 bytes are the checksum.
		const data = decoded.slice(0, 21);
		const checksum = decoded.slice(21);

		const expectedChecksum = sha256(sha256(data)).slice(0, 4);
		for (let i = 0; i < 4; i++) {
			if (checksum[i] !== expectedChecksum[i]) return false;
		}

		return data[0] === 0x41;
	} catch {
		return false;
	}
}

function validateTronHexAddress(address: string): boolean {
	try {
		const decoded = hex.decode(address);
		return decoded.length === 21 && decoded[0] === 0x41;
	} catch {
		return false;
	}
}

function validateTonAddress(address: string) {
	return /^[EU]Q[0-9A-Za-z_-]{46}$/.test(address);
}

function validateSuiAddress(address: string) {
	return /^(?:0x)?[a-fA-F0-9]{64}$/.test(address);
}

function validateStellarAddress(address: string) {
	return /^G[A-Z0-9]{55}$/.test(address);
}

function validateAptosAddress(address: string) {
	return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * Validates Cardano mainnet addresses (Base + Enterprise)
 * Returns true if valid, false if invalid
 */
export function validateCardanoAddress(address: string) {
	try {
		// max length big enough for any Cardano Bech32 addr
		const { prefix, words } = bech32.decode(
			address as `${string}1${string}`,
			120,
		);

		// only mainnet
		if (prefix !== "addr") return false;

		// convert 5-bit words back to bytes
		const data = bech32.fromWords(words);
		//@ts-expect-error
		const addrType = data[0] >> 4;

		return addrType >= 0 && addrType <= 7;
	} catch {
		return false;
	}
}

/**
 * Validates Starknet addresses
 * Starknet addresses are felt252 (252-bit field elements) represented as
 * hex strings with 0x prefix (up to 64 hex characters)
 */
function validateStarknetAddress(address: string): boolean {
	return /^0x[a-fA-F0-9]{1,64}$/.test(address);
}

export function validateLitecoinAddress(address: string): boolean {
	const first = address[0];

	// ---- Base58 (mainnet) ----

	// P2PKH: L... (0x30)
	if (first === "L") {
		return validateLitecoinBase58Address(address, 0x30);
	}

	// P2SH (new): M... (0x32)
	if (first === "M") {
		return validateLitecoinBase58Address(address, 0x32);
	}

	// P2SH (legacy): 3... (0x05)
	// [Inference] This also matches Bitcoin P2SH; cannot distinguish by prefix+version alone.
	if (first === "3") {
		return validateLitecoinBase58Address(address, 0x05);
	}

	// ---- Bech32 / Bech32m (SegWit) ----

	const lower = address.toLowerCase();
	if (!lower.startsWith("ltc1")) {
		return false;
	}

	return validateLitecoinBech32Address(address);
}

function validateLitecoinBase58Address(
	address: string,
	expectedVersion: number,
): boolean {
	let decoded: Uint8Array;

	try {
		decoded = base58.decode(address);
	} catch {
		return false;
	}

	// version (1) + payload (20) + checksum (4)
	if (decoded.length !== 25) return false;

	const version = decoded[0];
	if (version !== expectedVersion) return false;

	const payload = decoded.subarray(0, 21); // version + hash160
	const checksum = decoded.subarray(21, 25);

	const hash1 = sha256(payload);
	const hash2 = sha256(hash1);
	const expectedChecksum = hash2.subarray(0, 4);

	for (let i = 0; i < 4; i++) {
		if (checksum[i] !== expectedChecksum[i]) return false;
	}

	return true;
}

function validateLitecoinBech32Address(address: string): boolean {
	let decoded: {
		prefix: string;
		words: number[];
	};
	let isBech32m = false;

	try {
		// Try Bech32 (v0)
		decoded = bech32.decode(address as `${string}1${string}`);
	} catch {
		try {
			// If Bech32 failed, try Bech32m (v1+)
			decoded = bech32m.decode(address as `${string}1${string}`);
			isBech32m = true;
		} catch {
			return false;
		}
	}

	// HRP must be "ltc" (case-insensitive)
	if (decoded.prefix.toLowerCase() !== "ltc") return false;

	const { words } = decoded;
	if (!words || words.length < 1) return false;

	const version = words[0];
	if (version == null || version < 0 || version > 16) return false;

	const program = bech32.fromWords(words.slice(1));
	const progLen = program.length;

	// Generic SegWit constraints
	if (progLen < 2 || progLen > 40) return false;

	// v0: Bech32 only, 20 or 32 bytes
	if (version === 0) {
		if (isBech32m) return false;
		return progLen === 20 || progLen === 32;
	}

	// v1 (Taproot on LTC): Bech32m only, 32 bytes
	if (version === 1) {
		if (!isBech32m) return false;
		return progLen === 32;
	}

	// Other versions
	return false;
}

// ──────────────────────────────────────────────────────────────────────
// Edwards BLS12-377 curve parameters and arithmetic
//
// Matches the validation in snarkVM:
//   curves/src/templates/twisted_edwards_extended/affine.rs  (point decompression)
//   console/types/group/src/from_x_coordinate.rs            (subgroup check)
//   curves/src/edwards_bls12/parameters.rs                  (curve constants)
// ──────────────────────────────────────────────────────────────────────

/** Base field modulus (= scalar field order of BLS12-377). */
const P =
	8444461749428370424248824938781546531375899335154063827935233455917409239041n;

/** Edwards curve coefficient d.  Curve: -x² + y² = 1 + d·x²·y² (a = -1). */
const D = 3021n;

/** Prime-order subgroup order (= scalar field of Edwards BLS12-377, cofactor = 4). */
const SUBGROUP_ORDER =
	2111115437357092606062206234695386632838870926408408195193685246394721360383n;

// ── field helpers ────────────────────────────────────────────────────

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
	let result = 1n;
	base = ((base % m) + m) % m;
	while (exp > 0n) {
		if (exp & 1n) result = (result * base) % m;
		exp >>= 1n;
		base = (base * base) % m;
	}
	return result;
}

/** Tonelli-Shanks square root in F_P. Returns null when n is a non-residue. */
function modSqrt(n: bigint): bigint | null {
	n = ((n % P) + P) % P;
	if (n === 0n) return 0n;
	if (modPow(n, (P - 1n) / 2n, P) !== 1n) return null;

	// Factor P-1 = 2^s · q
	let s = 0;
	let q = P - 1n;
	while ((q & 1n) === 0n) {
		s++;
		q >>= 1n;
	}

	// Find a quadratic non-residue z
	let z = 2n;
	while (modPow(z, (P - 1n) / 2n, P) !== P - 1n) z++;

	let m = s;
	let c = modPow(z, q, P);
	let t = modPow(n, q, P);
	let r = modPow(n, (q + 1n) / 2n, P);

	for (;;) {
		if (t === 1n) return r;
		// Find least i such that t^(2^i) ≡ 1
		let i = 1;
		let tmp = (t * t) % P;
		while (tmp !== 1n) {
			tmp = (tmp * tmp) % P;
			i++;
		}
		// b = c^(2^(m-i-1))
		let b = c;
		for (let j = 0; j < m - i - 1; j++) b = (b * b) % P;
		m = i;
		c = (b * b) % P;
		t = (t * c) % P;
		r = (r * b) % P;
	}
}

// ── Extended twisted-Edwards point arithmetic ───────────────────────
// Representation: (X, Y, T, Z) with x = X/Z, y = Y/Z, T = X·Y/Z.
// Formulas from "Twisted Edwards Curves Revisited" §3 (a = -1 case).

type ExtPoint = readonly [bigint, bigint, bigint, bigint];

const EXT_ZERO: ExtPoint = [0n, 1n, 0n, 1n];

function extAdd(a: ExtPoint, b: ExtPoint): ExtPoint {
	const [X1, Y1, T1, Z1] = a;
	const [X2, Y2, T2, Z2] = b;
	const A = (X1 * X2) % P;
	const B = (Y1 * Y2) % P;
	const C = (((T1 * D) % P) * T2) % P;
	const Dd = (Z1 * Z2) % P;
	const E = (((((X1 + Y1) % P) * ((X2 + Y2) % P)) % P) - A - B + 2n * P) % P;
	const F = (((Dd - C) % P) + P) % P;
	const G = (Dd + C) % P;
	const H = (B + A) % P; // a = -1 → B - aA = B + A
	return [(E * F) % P, (G * H) % P, (E * H) % P, (F * G) % P];
}

function extDouble(a: ExtPoint): ExtPoint {
	const [X, Y, _T, Z] = a;
	const A = (X * X) % P;
	const B = (Y * Y) % P;
	const C = (2n * ((Z * Z) % P)) % P;
	const Dd = (P - A) % P; // a·A = -A
	const E = (((((X + Y) % P) * ((X + Y) % P)) % P) - A - B + 2n * P) % P;
	const G = (Dd + B) % P;
	const F = (((G - C) % P) + P) % P;
	const H = (((Dd - B) % P) + P) % P;
	return [(E * F) % P, (G * H) % P, (E * H) % P, (F * G) % P];
}

function scalarMul(pt: ExtPoint, scalar: bigint): ExtPoint {
	let result: ExtPoint = EXT_ZERO;
	let base = pt;
	let s = scalar;
	while (s > 0n) {
		if (s & 1n) result = extAdd(result, base);
		base = extDouble(base);
		s >>= 1n;
	}
	return result;
}

/** Check whether an extended point is the identity (0, 1). */
function isIdentity(pt: ExtPoint): boolean {
	// X/Z == 0  and  Y/Z == 1  ⟹  X == 0  and  Y == Z
	return pt[0] === 0n && pt[1] === pt[3];
}

// ── public API ──────────────────────────────────────────────────────

/**
 * Validates an Aleo address by decoding the bech32m payload, decompressing
 * the Edwards BLS12-377 point, and verifying it lies in the prime-order
 * subgroup — matching snarkVM's `Group::from_x_coordinate` exactly.
 *
 * Compressed format: x-coordinate (little-endian, 32 bytes) with y-sign
 * flag in bit 7 of byte 31.
 */
export function validateAleoAddress(address: string): boolean {
	try {
		const decoded = bech32m.decodeToBytes(address);
		if (decoded.prefix !== "aleo") return false;
		if (decoded.bytes.length !== 32) return false;

		// Extract x-coordinate, clearing the y-sign flag (MSB of last byte)
		const bytes = new Uint8Array(decoded.bytes);
		bytes[31] = (bytes[31] as number) & 0x7f;

		let x = 0n;
		for (let i = 31; i >= 0; i--) {
			x = (x << 8n) | BigInt(bytes[i] as number);
		}
		if (x >= P) return false;

		// y² = (1 + x²) / (1 - d·x²)  (equivalent to Rust: (a·x²-1)/(d·x²-1) with a=-1)
		const x2 = (x * x) % P;
		const num = (1n + x2) % P;
		const den = (((1n - ((D * x2) % P)) % P) + P) % P;
		if (den === 0n) return false;

		const denInv = modPow(den, P - 2n, P);
		const y2 = (num * denInv) % P;

		// Decompress: recover y via square root
		const y = modSqrt(y2);
		if (y === null) return false;

		// snarkVM checks both (x, y) and (x, -y) for subgroup membership
		const negY = y === 0n ? 0n : P - y;
		const p1: ExtPoint = [x, y, (x * y) % P, 1n];
		const p2: ExtPoint = [x, negY, (x * negY) % P, 1n];

		for (const pt of [p1, p2]) {
			if (isIdentity(scalarMul(pt, SUBGROUP_ORDER))) return true;
		}
		return false;
	} catch {
		return false;
	}
}

import { sha256 } from "@noble/hashes/sha2";
import { base58, hex } from "@scure/base";
import { getAddress } from "viem";
import { Chains, type Chain } from "./caip2";
import { tryParseTonAddress } from "./ton-address";

export function compareAddresses(
	a: string,
	b: string,
	blockchain: Chain,
): boolean {
	try {
		switch (blockchain) {
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
			case Chains.Abstract:
			case Chains.HyperCore:
			case Chains.HyperEvm:
				return getAddress(a) === getAddress(b);
			case Chains.Aptos:
			case Chains.Movement:
			case Chains.Sui:
			case Chains.Starknet:
				return compareHexAddress(a, b);
			case Chains.TON:
				return compareTonAddress(a, b);
			case Chains.Tron:
				return compareTronAddress(a, b);
			case Chains.Stellar:
				return a.toUpperCase() === b.toUpperCase();
			case Chains.Near:
			case Chains.Bitcoin:
			case Chains.BitcoinCash:
			case Chains.Zcash:
			case Chains.Dogecoin:
			case Chains.Litecoin:
			case Chains.Solana:
			case Chains.Fogo:
			case Chains.XRPL:
			case Chains.Cardano:
			case Chains.Aleo:
			case Chains.Dash:
				return a === b;
			default:
				blockchain satisfies never;
				return false;
		}
	} catch {
		return false;
	}
}

// Aptos/Movement/Sui/Starknet addresses are hex field elements: case is not
// significant, and both zero-padded (0x000...01) and short (0x1) forms refer
// to the same address.
function compareHexAddress(a: string, b: string): boolean {
	return normalizeHexAddress(a) === normalizeHexAddress(b);
}

function normalizeHexAddress(address: string): string {
	const withoutPrefix = address.toLowerCase().startsWith("0x")
		? address.slice(2)
		: address;
	const withoutLeadingZeros = withoutPrefix.replace(/^0+/, "");
	return withoutLeadingZeros.toLowerCase() || "0";
}

// TON accounts have multiple valid textual forms (raw "0:hex", friendly
// base64/base64url, bounceable/non-bounceable) that all refer to the same
// (workchain, address) pair.
function compareTonAddress(a: string, b: string): boolean {
	const parsedA = tryParseTonAddress(a);
	const parsedB = tryParseTonAddress(b);
	if (parsedA === null || parsedB === null) return false;

	return (
		parsedA.workchainId === parsedB.workchainId &&
		bytesEqual(parsedA.address, parsedB.address)
	);
}

// Tron addresses are represented either as base58check (T...) or as hex
// (41...); both encode the same 21-byte version+hash160 payload.
function compareTronAddress(a: string, b: string): boolean {
	const payloadA = decodeTronAddress(a);
	const payloadB = decodeTronAddress(b);
	if (payloadA === null || payloadB === null) return false;

	return bytesEqual(payloadA, payloadB);
}

function decodeTronAddress(address: string): Uint8Array | null {
	const base58Payload = decodeTronBase58Address(address);
	if (base58Payload !== null) return base58Payload;

	return decodeTronHexAddress(address);
}

function decodeTronBase58Address(address: string): Uint8Array | null {
	try {
		const decoded = base58.decode(address);
		if (decoded.length !== 25) return null;

		// version (1) + hash160 (20) + checksum (4)
		const payload = decoded.subarray(0, 21);
		const checksum = decoded.subarray(21, 25);
		const expectedChecksum = sha256(sha256(payload)).subarray(0, 4);
		for (let i = 0; i < 4; i++) {
			if (checksum[i] !== expectedChecksum[i]) return null;
		}

		return payload[0] === 0x41 ? payload : null;
	} catch {
		return null;
	}
}

function decodeTronHexAddress(address: string): Uint8Array | null {
	try {
		const decoded = hex.decode(address);
		if (decoded.length !== 21) return null;
		return decoded[0] === 0x41 ? decoded : null;
	} catch {
		return null;
	}
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

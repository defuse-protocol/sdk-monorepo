import { sha256 } from "@noble/hashes/sha256";
import { base58, bech32m, hex, bech32 } from "@scure/base";
import { PublicKey } from "@solana/web3.js";
import {
	isValidClassicAddress as xrp_isValidClassicAddress,
	isValidXAddress as xrp_isValidXAddress,
} from "ripple-address-codec";
import { Chains, type Chain } from "./caip2";
import { isAddress } from "viem";
import { utils } from "@defuse-protocol/internal-utils";

export function validateAddress(address: string, blockchain: Chain): boolean {
	if (blockchain.startsWith("eip155:")) {
		return validateEthAddress(address);
	}
	switch (blockchain) {
		case Chains.Near:
			return utils.validateNearAddress(address);
		case Chains.Bitcoin:
			return validateBtcAddress(address);
		case Chains.Solana:
			return validateSolAddress(address);

		case Chains.Dogecoin:
			return validateDogeAddress(address);

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

		default:
			return false;
	}
}

function validateEthAddress(address: string) {
	return isAddress(address, { strict: true });
}

function validateBtcAddress(address: string) {
	return (
		/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) ||
		/^3[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) ||
		/^bc1[02-9ac-hj-np-z]{11,87}$/.test(address) ||
		/^bc1p[02-9ac-hj-np-z]{42,87}$/.test(address)
	);
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

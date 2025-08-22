import { base58, hex } from "@scure/base";

export const tronAddressToHex = (credential: string) => {
	try {
		const payload = base58.decode(credential);

		// Tron addresses can be 21 bytes (no checksum) or 25 bytes (with checksum)
		// We need the first 21 bytes which contain the version byte + address
		if (payload.length < 21) {
			throw new Error("Invalid Tron address: too short");
		}

		// Take the first 21 bytes (version byte + 20-byte address)
		const addressBytes = payload.slice(0, 21);

		// Check if it starts with the correct Tron prefix (0x41)
		if (addressBytes[0] !== 0x41) {
			throw new Error("Invalid Tron address: wrong prefix");
		}

		return hex.encode(addressBytes);
	} catch (_error) {
		throw new Error("Invalid Tron address");
	}
};

import { base58 } from "@scure/base";

export const tronAddressToHex = (credential: string) => {
	try {
		const decoded = base58.decode(credential);
		const addressHex = Array.from(decoded)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");

		// Return hex string with 41 prefix but without 0x prefix, truncated to 21 bytes (42 hex chars)
		return addressHex.substring(0, 42);
	} catch {
		throw new Error("Invalid Tron address");
	}
};

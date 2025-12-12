export function hexToBip32Path(hexString: Hex): string {
	const cleanHex = hexString.slice(2);
	if (cleanHex.length !== 64) {
		throw new Error(
			`Expected 64 hex characters (32 bytes), got ${cleanHex.length}`,
		);
	}

	if (!/^[0-9a-fA-F]+$/.test(cleanHex)) {
		throw new Error("Invalid hex string: contains non-hexadecimal characters");
	}

	const path = [];
	const nonHardenedLimit = 2 ** 31 - 1;
	for (let i = 0; i < 64; i += 8) {
		const chunk = cleanHex.slice(i, i + 8);
		const value = parseInt(chunk, 16) % nonHardenedLimit;
		path.push(value.toString());
	}
	return path.join("/");
}
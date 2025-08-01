import { base32 } from "@scure/base";
import { calculateChecksum } from "./decodeCheck";

const versionBytes = {
	accountId: 0x30,
	seed: 0x90,
	preAuthTx: 0x98,
	sha256Hash: 0x28,
} as const;

type VersionByteName = keyof typeof versionBytes;

export function encodeCheck(
	versionByteName: VersionByteName,
	data: Uint8Array,
): string {
	const versionByte = versionBytes[versionByteName];

	if (versionByte === undefined) {
		throw new Error(
			`${versionByteName} is not a valid version byte name. ` +
				`Expected one of ${Object.keys(versionBytes).join(", ")}`,
		);
	}

	// Create payload: version byte + data
	const payload = new Uint8Array(1 + data.length);
	payload[0] = versionByte;
	payload.set(data, 1);

	// Calculate checksum
	const checksum = calculateChecksum(payload);

	// Combine payload and checksum
	const combined = new Uint8Array(payload.length + checksum.length);
	combined.set(payload);
	combined.set(checksum, payload.length);

	// Encode to base32
	return base32.encode(combined);
}

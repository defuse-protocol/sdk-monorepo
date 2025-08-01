import { base32 } from "@scure/base";
import { calculateChecksum } from "./decodeCheck";

export function encodeCheck(data: Uint8Array): string {
	const payload = new Uint8Array(1 + data.length);
	payload[0] = 0x30; // accountId version byte
	payload.set(data, 1);

	const checksum = calculateChecksum(payload);

	// Combine payload and checksum
	const combined = new Uint8Array(payload.length + checksum.length);
	combined.set(payload);
	combined.set(checksum, payload.length);

	return base32.encode(combined);
}

/**
 * CRC16-XModem (poly 0x1021, init 0x0000) used by Stellar StrKey checksums.
 * See https://stellar.org/protocol/sep-23
 */
export function crc16xmodem(data: Uint8Array): number {
	let crc = 0x0000;
	for (const byte of data) {
		crc ^= byte << 8;
		for (let i = 0; i < 8; i++) {
			crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
		}
		crc &= 0xffff;
	}
	return crc;
}

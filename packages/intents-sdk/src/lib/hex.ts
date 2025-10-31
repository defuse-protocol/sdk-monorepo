/**
 * @description verifies value is a non 0x-prefixed hex string
 */
export default function isHex(value: string): boolean {
	return value.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(value);
}

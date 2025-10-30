/**
 *
 * @description tests that value is a non 0x prefixed hex string
 * @returns
 */
export default function isHex(value: string): boolean {
	return /^[0-9A-Fa-f]+$/.test(value);
}

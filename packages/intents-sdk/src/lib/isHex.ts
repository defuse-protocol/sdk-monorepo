export default function isHex(str: string): boolean {
	return /^[0-9A-Fa-f]+$/.test(str);
}

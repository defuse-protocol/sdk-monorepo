export function toError(unknown: unknown): Error {
	return unknown instanceof Error ? unknown : new Error(String(unknown));
}

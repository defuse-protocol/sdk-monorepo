/**
 * `JSON.stringify` that won't throw on `BigInt` values.
 *
 * Standard `JSON.stringify` throws `TypeError: Do not know how to serialize a
 * BigInt`. This serializes a BigInt as its decimal string (e.g. `123n` →
 * `"123"`) so it's safe to drop into log and error messages. Any other
 * non-serializable input (e.g. a circular reference) falls back to `String()`
 * instead of throwing, so the function never throws.
 *
 * The BigInt → string conversion is lossy (you can't tell it from a real
 * string on parse). For lossless, round-trippable output (tagged BigInt/Map,
 * named circular refs) use {@link serialize} instead.
 *
 * @param value - The value to stringify.
 * @param space - Indentation passed through to `JSON.stringify`.
 * @returns The serialized string.
 */
export function safeStringify(value: unknown, space?: number): string {
	try {
		const serialized = JSON.stringify(
			value,
			(_key, val: unknown) => (typeof val === "bigint" ? val.toString() : val),
			space,
		);
		return serialized ?? String(value);
	} catch {
		return String(value);
	}
}

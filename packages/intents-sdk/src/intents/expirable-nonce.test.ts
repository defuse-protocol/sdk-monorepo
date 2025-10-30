import { describe, expect, it } from "vitest";
import { base64 } from "@scure/base";
import {
	LATEST_VERSION,
	VERSIONED_MAGIC_PREFIX,
	VersionedNonceBuilder,
} from "./expirable-nonce";
import { serialize } from "near-api-js/lib/utils/serialize";

const salt = Uint8Array.from([1, 2, 3, 4]);

describe("expirable nonce", () => {
	it("roundtrip encode/decode", () => {
		const deadline = new Date();

		const encoded = VersionedNonceBuilder.encodeNonce(salt, deadline);
		const decoded = VersionedNonceBuilder.decodeNonce(encoded);

		expect(decoded.version).toBe(LATEST_VERSION);

		const value = decoded.value;

		expect(Array.from(value.salt)).toEqual(Array.from(salt));
		expect(value.inner.nonce.length).toBe(15);
		expect(value.inner.deadline).toBe(BigInt(deadline.getTime()) * 1_000_000n);
	});

	it("encoded payload is valid", () => {
		const deadline = new Date();
		const encoded = VersionedNonceBuilder.encodeNonce(salt, deadline);
		const bytes = base64.decode(encoded);

		expect(bytes.length).toBe(32);

		expect(bytes.slice(0, 4)).toEqual(VERSIONED_MAGIC_PREFIX);
		expect(bytes[4]).toBe(LATEST_VERSION);
		expect(bytes.slice(5, 9)).toEqual(salt);
		expect(bytes.slice(9, 17)).toEqual(
			serialize("u64", BigInt(deadline.getTime()) * 1_000_000n),
		);
	});

	it("rejects invalid prefix", () => {
		const deadline = new Date();
		const encoded = VersionedNonceBuilder.encodeNonce(salt, deadline);
		const bytes = base64.decode(encoded);

		expect(bytes.length).toBe(32);

		const corrupted = bytes.slice();
		corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;

		const corruptedEncoded = base64.encode(corrupted);

		expect(() =>
			VersionedNonceBuilder.decodeNonce(corruptedEncoded),
		).toThrowError(/Invalid magic prefix/);
	});
});

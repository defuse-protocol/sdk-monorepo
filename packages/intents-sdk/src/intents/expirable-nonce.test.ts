import { describe, expect, it } from "vitest";
import { base64, hex } from "@scure/base";
import {
	EXPIRABLE_NONCE_PREFIX,
	decodeNonce,
	encodeNonce,
	generateExpirableNonce,
	isNonceExpired,
} from "./expirable-nonce";

describe("expirable nonce", () => {
	it("should generate valid nonce", () => {
		const deadline = new Date();
		const nonce = generateExpirableNonce(deadline);

		expect(typeof nonce.deadline).toBe("bigint");
		expect(nonce.nonce).toBeInstanceOf(Uint8Array);
		expect(nonce.nonce.length).toBe(20);
		expect(nonce.deadline).toBe(BigInt(deadline.getTime()) * 1_000_000n);
	});

	it("roundtrip encode/decode", () => {
		const deadline = new Date();
		const original = generateExpirableNonce(deadline);
		const encoded = encodeNonce(original);
		const decoded = decodeNonce(encoded);

		expect(decoded.deadline).toBe(original.deadline);
		expect(decoded.nonce).toEqual(original.nonce);
	});

	it("encoded payload is valid", () => {
		const deadline = new Date();
		const nonce = generateExpirableNonce(deadline);
		const encoded = encodeNonce(nonce);

		const bytes = base64.decode(encoded);
		expect(bytes.length).toBe(32);

		expect(bytes.slice(0, 4)).toEqual(EXPIRABLE_NONCE_PREFIX);
		expect(hex.encode(bytes.slice(4, 12))).toEqual(
			nonce.deadline.toString(16).padStart(16, "0"),
		);
		expect(bytes.slice(12, 32)).toEqual(nonce.nonce);
	});

	it("rejects invalid prefix", () => {
		const d = new Date();
		const encoded = encodeNonce(generateExpirableNonce(d));
		const bytes = base64.decode(encoded);

		expect(bytes.length).toBe(32);

		const corrupted = bytes.slice();
		corrupted[0] = (corrupted[0] ?? 0) ^ 0xff;

		const corruptedEncoded = base64.encode(corrupted);

		expect(() => decodeNonce(corruptedEncoded)).toThrowError(
			/Invalid expirable nonce: wrong prefix|incorrect length/,
		);
	});

	it("detects expiration correctly", () => {
		const deadline = new Date("2026-01-01T00:01:00.000Z");
		const nonce = generateExpirableNonce(deadline);

		// before deadline
		expect(isNonceExpired(nonce, new Date("2025-01-01T00:01:00.000Z"))).toBe(
			false,
		);
		// at deadline
		expect(isNonceExpired(nonce, new Date("2026-01-01T00:01:00.000Z"))).toBe(
			true,
		);
		// after deadline
		expect(isNonceExpired(nonce, new Date("2027-01-01T00:01:00.000Z"))).toBe(
			true,
		);
	});
});

import { describe, expect, it } from "vitest";
import { base64 } from "@scure/base";
import {
	LATEST_VERSION,
	VERSIONED_MAGIC_PREFIX,
	VersionedNonceBuilder,
	saltedNonceSchema,
} from "./expirable-nonce";
import { serialize } from "near-api-js/lib/utils/serialize";
import * as v from "valibot";

const salt = Uint8Array.from([1, 2, 3, 4]);

describe("expirable nonce", () => {
	it("roundtrip encode/decode", () => {
		const deadline = new Date();

		const encoded = VersionedNonceBuilder.encodeNonce(salt, deadline);
		const decoded = VersionedNonceBuilder.decodeNonce(encoded);

		expect(decoded.version).toBe(LATEST_VERSION);

		// Use the exported schema for validation
		const value = v.parse(saltedNonceSchema, decoded.value);

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

	it("rejects invalid randomBytes length", () => {
		const deadline = new Date();
		const tooShort = new Uint8Array(10);
		const tooLong = new Uint8Array(20);

		expect(() =>
			VersionedNonceBuilder.encodeNonce(salt, deadline, tooShort),
		).toThrowError(/Invalid randomBytes length: 10, expected 15/);

		expect(() =>
			VersionedNonceBuilder.encodeNonce(salt, deadline, tooLong),
		).toThrowError(/Invalid randomBytes length: 20, expected 15/);
	});

	it("accepts custom randomBytes", () => {
		const deadline = new Date();
		const customBytes = new Uint8Array(15).fill(0xab);

		const encoded = VersionedNonceBuilder.encodeNonce(
			salt,
			deadline,
			customBytes,
		);
		const decoded = VersionedNonceBuilder.decodeNonce(encoded);
		const value = v.parse(saltedNonceSchema, decoded.value);

		expect(value.inner.nonce).toEqual(Array.from(customBytes));
	});

	describe("createTimestampedNonceBytes", () => {
		it("embeds startTime in first 8 bytes as nanoseconds LE", () => {
			const startTime = new Date(1700000000000); // fixed timestamp
			const bytes =
				VersionedNonceBuilder.createTimestampedNonceBytes(startTime);

			expect(bytes.length).toBe(15);

			const view = new DataView(bytes.buffer);
			const embeddedNanos = view.getBigInt64(0, true);
			expect(embeddedNanos).toBe(BigInt(startTime.getTime()) * 1_000_000n);
		});

		it("fills remaining 7 bytes with random data", () => {
			const startTime = new Date();
			const bytes1 =
				VersionedNonceBuilder.createTimestampedNonceBytes(startTime);
			const bytes2 =
				VersionedNonceBuilder.createTimestampedNonceBytes(startTime);

			// First 8 bytes should be same (same startTime)
			expect(bytes1.subarray(0, 8)).toEqual(bytes2.subarray(0, 8));

			// Last 7 bytes should differ (random) — extremely unlikely to collide
			expect(bytes1.subarray(8)).not.toEqual(bytes2.subarray(8));
		});

		it("works with encodeNonce roundtrip", () => {
			const startTime = new Date(1700000000000);
			const deadline = new Date(startTime.getTime() + 30000);
			const timestampedBytes =
				VersionedNonceBuilder.createTimestampedNonceBytes(startTime);

			const encoded = VersionedNonceBuilder.encodeNonce(
				salt,
				deadline,
				timestampedBytes,
			);
			const decoded = VersionedNonceBuilder.decodeNonce(encoded);
			const value = v.parse(saltedNonceSchema, decoded.value);

			// Verify the embedded timestamp is preserved
			const nonceBytes = new Uint8Array(value.inner.nonce);
			const view = new DataView(nonceBytes.buffer);
			const embeddedNanos = view.getBigInt64(0, true);
			expect(embeddedNanos).toBe(BigInt(startTime.getTime()) * 1_000_000n);
		});
	});
});

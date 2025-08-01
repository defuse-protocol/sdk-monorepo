import { describe, expect, it } from "vitest";
import { stellarAddressToBytes } from "./stellarAddressToBytes";

describe("stellarAddressToBytes", () => {
	describe("Stellar account ID validation", () => {
		it("should decode valid Stellar account ID", () => {
			const result = stellarAddressToBytes(
				"GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
			);
			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should throw error for invalid checksum when version byte is wrong", () => {
			expect(() => {
				stellarAddressToBytes(
					"SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
				);
			}).toThrow("invalid checksum");
		});

		it("should throw error for invalid checksum", () => {
			expect(() => {
				stellarAddressToBytes(
					"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
				);
			}).toThrow("invalid checksum");
		});

		it("should throw error for invalid base32 encoding", () => {
			expect(() => {
				stellarAddressToBytes("invalid_base32_string!!!");
			}).toThrow("Unknown letter");
		});
	});

	describe("Real Stellar addresses", () => {
		it("should handle real Stellar account ID", () => {
			const result = stellarAddressToBytes(
				"GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
			);
			expect(result).toBeInstanceOf(Buffer);
			// The decoded result should be 32 bytes (Stellar public key length)
			expect(result.length).toBe(32);
		});
	});
});

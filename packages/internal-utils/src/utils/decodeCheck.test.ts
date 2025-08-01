import { describe, expect, it } from "vitest";
import { decodeCheck } from "./decodeCheck";

describe("decodeCheck", () => {
	describe("Stellar account ID validation", () => {
		it("should decode valid Stellar account ID", () => {
			const result = decodeCheck(
				"accountId",
				"GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
			);
			expect(result).toBeInstanceOf(Buffer);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should throw error for invalid version byte", () => {
			expect(() => {
				decodeCheck(
					"accountId",
					"SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
				);
			}).toThrow("invalid version byte");
		});

		it("should throw error for invalid checksum", () => {
			expect(() => {
				decodeCheck(
					"accountId",
					"GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
				);
			}).toThrow("invalid checksum");
		});

		it("should throw error for invalid base32 encoding", () => {
			expect(() => {
				decodeCheck("accountId", "invalid_base32_string!!!");
			}).toThrow("Unknown letter");
		});

		it("should throw error for invalid version byte name", () => {
			expect(() => {
				decodeCheck(
					// @ts-expect-error - Testing invalid version byte name
					"invalidType",
					"GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
				);
			}).toThrow("invalidType is not a valid version byte name");
		});
	});

	describe("Real Stellar addresses", () => {
		it("should handle real Stellar account ID", () => {
			const result = decodeCheck(
				"accountId",
				"GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
			);
			expect(result).toBeInstanceOf(Buffer);
			// The decoded result should be 32 bytes (Stellar public key length)
			expect(result.length).toBe(32);
		});
	});
});

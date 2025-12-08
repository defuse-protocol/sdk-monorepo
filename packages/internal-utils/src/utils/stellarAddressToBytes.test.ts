import { hex } from "@scure/base";
import { describe, expect, it } from "vitest";
import {
	bytesToStellarAddress,
	stellarAddressToBytes,
} from "./stellarAddressToBytes";

describe("stellarAddressToBytes", () => {
	describe("Stellar account ID validation", () => {
		it("should decode valid Stellar account ID", () => {
			const userAddressToBytes = stellarAddressToBytes(
				"GCI423LPYVEX5YCJBWXEI76EKRO72ETQCS3KBUE2SRH4PI2T2LSB55FF",
			);
			expect(userAddressToBytes).toBeInstanceOf(Uint8Array);
			expect(userAddressToBytes.length).toBeGreaterThan(0);
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
			const userAddressToBytes = stellarAddressToBytes(
				"GCI423LPYVEX5YCJBWXEI76EKRO72ETQCS3KBUE2SRH4PI2T2LSB55FF",
			);
			expect(userAddressToBytes).toBeInstanceOf(Uint8Array);
			// The decoded result should be 32 bytes (Stellar public key length)
			expect(userAddressToBytes.length).toBe(32);
		});
	});
});

describe("bytesToStellarAddress", () => {
	it("should encode the public key correctly", () => {
		const userAddress =
			"91cd6d6fc5497ee0490dae447fc4545dfd127014b6a0d09a944fc7a353d2e41e";
		const publicKey = bytesToStellarAddress(hex.decode(userAddress));
		expect(publicKey).toBe(
			"GCI423LPYVEX5YCJBWXEI76EKRO72ETQCS3KBUE2SRH4PI2T2LSB55FF",
		);
	});
});

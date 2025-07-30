import { describe, expect, it } from "vitest";
import { Chains, getEIP155ChainId } from "./caip2";

describe("CAIP2 utilities", () => {
	describe("getEIP155ChainId()", () => {
		it("should extract chain ID from valid EIP-155 CAIP2 identifiers", () => {
			expect(getEIP155ChainId("eip155:1")).toBe(1);
			expect(getEIP155ChainId("eip155:56")).toBe(56);
			expect(getEIP155ChainId("eip155:8453")).toBe(8453);
			expect(getEIP155ChainId("eip155:42161")).toBe(42161);
		});

		it("should work with actual chain constants", () => {
			expect(getEIP155ChainId(Chains.Ethereum)).toBe(1);
			expect(getEIP155ChainId(Chains.BNB)).toBe(56);
			expect(getEIP155ChainId(Chains.Base)).toBe(8453);
			expect(getEIP155ChainId(Chains.Arbitrum)).toBe(42161);
			expect(getEIP155ChainId(Chains.Polygon)).toBe(137);
		});

		it("should throw for non-EIP155 chain constants", () => {
			expect(() => getEIP155ChainId(Chains.Near)).toThrow(
				"Chain is not an EIP-155 chain",
			);
			expect(() => getEIP155ChainId(Chains.Bitcoin)).toThrow(
				"Chain is not an EIP-155 chain",
			);
			expect(() => getEIP155ChainId(Chains.Solana)).toThrow(
				"Chain is not an EIP-155 chain",
			);
		});

		it("should throw for invalid EIP-155 formats", () => {
			expect(() => getEIP155ChainId("eip155:")).toThrow(
				"Chain is not an EIP-155 chain",
			);
			expect(() => getEIP155ChainId("eip155:abc")).toThrow(
				"Chain is not an EIP-155 chain",
			);
			expect(() => getEIP155ChainId("invalid:1")).toThrow(
				"Chain is not an EIP-155 chain",
			);
			expect(() => getEIP155ChainId("eip155")).toThrow(
				"Chain is not an EIP-155 chain",
			);
		});

		it("should handle edge cases", () => {
			expect(getEIP155ChainId("eip155:0")).toBe(0);
			expect(getEIP155ChainId("eip155:999999")).toBe(999999);
		});
	});
});

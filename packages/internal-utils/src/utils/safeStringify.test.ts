import { describe, expect, it } from "vitest";
import { safeStringify } from "./safeStringify";

describe("safeStringify()", () => {
	it("serializes nested BigInt values as decimal strings", () => {
		const result = safeStringify({ gas: 5n, nested: { amount: 100n } });

		expect(result).toBe('{"gas":"5","nested":{"amount":"100"}}');
	});

	it("matches JSON.stringify for BigInt-free values", () => {
		const value = { a: 1, b: ["x", null], c: true };

		expect(safeStringify(value)).toBe(JSON.stringify(value));
	});

	it("falls back to a string instead of throwing on circular references", () => {
		const circular: Record<string, unknown> = { id: 1n };
		circular.self = circular;

		expect(() => safeStringify(circular)).not.toThrow();
	});
});

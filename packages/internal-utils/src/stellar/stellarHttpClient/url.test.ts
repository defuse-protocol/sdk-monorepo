import { describe, expect, it } from "vitest";
import { buildHorizonUrl } from "./url";

describe("buildHorizonUrl()", () => {
	const path = `accounts/${encodeURIComponent("GABC")}`;

	it.each([
		{
			name: "baseURL without a path",
			baseURL: "https://horizon.stellar.org",
			expected: "https://horizon.stellar.org/accounts/GABC",
		},
		{
			name: "baseURL with a path and no trailing slash",
			baseURL:
				"https://quick-amogus.stellar-mainnet.slownode.pro/token-no-slash",
			expected:
				"https://quick-amogus.stellar-mainnet.slownode.pro/token-no-slash/accounts/GABC",
		},
		{
			name: "baseURL with a path and a trailing slash",
			baseURL: "https://quick-amogus.stellar-mainnet.slownode.pro/token/",
			expected:
				"https://quick-amogus.stellar-mainnet.slownode.pro/token/accounts/GABC",
		},
		{
			name: "baseURL with query params and no trailing slash",
			baseURL: "https://horizon.example.com/v1?api_key=test-key",
			expected: "https://horizon.example.com/v1/accounts/GABC?api_key=test-key",
		},
		{
			name: "baseURL with query params and a trailing slash",
			baseURL: "https://horizon.example.com/v1/?api_key=test-key",
			expected: "https://horizon.example.com/v1/accounts/GABC?api_key=test-key",
		},
		{
			name: "baseURL with repeated trailing slashes",
			baseURL: "https://horizon.example.com/v1///?api_key=test-key",
			expected: "https://horizon.example.com/v1/accounts/GABC?api_key=test-key",
		},
	])("keeps path and query params of a $name", ({ baseURL, expected }) => {
		expect(buildHorizonUrl(baseURL, path).href).toBe(expected);
	});
});

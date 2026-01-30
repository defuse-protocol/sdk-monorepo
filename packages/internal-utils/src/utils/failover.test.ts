import { providers } from "near-api-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNearFailoverRpcProvider } from "./failover";
import { extractRpcUrls } from "./rpc-endpoint";

const unstableRpcProvider = {
	startTime: Date.now(),
	status: vi.fn(() => {
		if (Date.now() - unstableRpcProvider.startTime > 500) {
			throw new Error("rpc down");
		}
		return { status: 200, result: "ok", id: 1 };
	}),
};

const stableRpcProvider = {
	status: vi.fn(() => {
		return { status: 200, result: "ok", id: 2 };
	}),
};

const providers_ = [
	Object.setPrototypeOf(
		unstableRpcProvider,
		providers.JsonRpcProvider.prototype,
	),
	Object.setPrototypeOf(stableRpcProvider, providers.JsonRpcProvider.prototype),
];

describe("createNearFailoverRpcProvider", () => {
	let nearClient: providers.FailoverRpcProvider;

	beforeEach(() => {
		nearClient = createNearFailoverRpcProvider({ providers: providers_ });
		vi.spyOn(nearClient, "status");
	});

	it("should return the status of the first provider when it is operational", async () => {
		const response = unstableRpcProvider.status();
		expect(response.status).toBe(200);
		expect(await nearClient.status()).toStrictEqual(response);
	});

	it("should switch to the second provider after 500ms if the first provider becomes unresponsive", async () => {
		const response = stableRpcProvider.status();
		vi.useFakeTimers();
		vi.advanceTimersByTime(500);

		// Suppress error output
		console.error = vi.fn();

		expect(await nearClient.status()).toStrictEqual(response);
		vi.useRealTimers();
	});
});

describe("extractRpcUrls", () => {
	it("extracts URLs from string endpoints", () => {
		const endpoints = ["https://rpc1.example.com", "https://rpc2.example.com"];
		expect(extractRpcUrls(endpoints)).toEqual(endpoints);
	});

	it("extracts URLs from config objects", () => {
		const endpoints = [
			{ url: "https://rpc1.example.com", headers: { "X-Api-Key": "abc" } },
			{ url: "https://rpc2.example.com" },
		];
		expect(extractRpcUrls(endpoints)).toEqual([
			"https://rpc1.example.com",
			"https://rpc2.example.com",
		]);
	});

	it("strips credentials from URLs", () => {
		const endpoints = ["http://user:pass@localhost:3030"];
		const result = extractRpcUrls(endpoints);
		expect(result[0]).toBe("http://localhost:3030/");
		expect(result[0]).not.toContain("user");
		expect(result[0]).not.toContain("pass");
	});

	it("handles mixed endpoint types", () => {
		const endpoints = [
			"https://public-rpc.example.com",
			{
				url: "https://private-rpc.example.com",
				headers: { Authorization: "Bearer token" },
			},
		];
		expect(extractRpcUrls(endpoints)).toEqual([
			"https://public-rpc.example.com",
			"https://private-rpc.example.com",
		]);
	});
});

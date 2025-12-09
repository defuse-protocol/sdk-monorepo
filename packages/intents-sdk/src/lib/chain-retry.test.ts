import { RETRY_CONFIGS } from "@defuse-protocol/internal-utils";
import { describe, expect, test } from "vitest";
import { getRetryOptionsForChain } from "./chain-retry";

describe("getRetryOptionsForChain", () => {
	test("returns chain-specific retry options for known chain", () => {
		const result = getRetryOptionsForChain("eip155:1"); // eth, p99: 1852s

		expect(result).toEqual({
			delay: 2000,
			factor: 1.3,
			maxAttempts: 24,
		});
	});

	test("returns fallback for unknown chain", () => {
		const result = getRetryOptionsForChain(
			"eip155:999999" as Parameters<typeof getRetryOptionsForChain>[0],
		);

		expect(result).toEqual(RETRY_CONFIGS.TWO_HOURS_PERSISTENT);
	});

	test("faster chains have fewer retry attempts", () => {
		const fastChain = getRetryOptionsForChain("eip155:56"); // bsc, p99: 36s
		const slowChain = getRetryOptionsForChain(
			"bip122:000000000019d6689c085ae165831e93",
		); // bitcoin, p99: 3656s

		expect(fastChain.maxAttempts).toBeLessThan(slowChain.maxAttempts!);
	});
});

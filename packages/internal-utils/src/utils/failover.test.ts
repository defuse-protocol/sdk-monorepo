import { providers } from "near-api-js";
import type { FailoverRpcProvider } from "near-api-js/lib/providers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNearFailoverRpcProvider } from "./failover";

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
	let nearClient: FailoverRpcProvider;

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

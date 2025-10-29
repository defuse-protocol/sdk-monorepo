import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SALT_TTL_MS, SaltManager } from "../intents/salt-manager";
import type { providers } from "near-api-js";

import {
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";

const fetchSaltSpy = vi.spyOn(SaltManager.prototype as any, "fetchAndCache");
const initialSalt = 12345;

describe("SaltManager", () => {
	describe("fetching salt from contract", () => {
		it("should fetch salt on first call", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const saltManager = new SaltManager({
				env: "production",
				nearProvider,
			});

			const salt = await saltManager.getCachedSalt();

			expect(typeof salt).toBe("number");
			expect(salt).toBeGreaterThan(0);
			expect(fetchSaltSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("unit tests with mocks", () => {
		beforeEach(() => {
			vi.clearAllMocks();
			vi.useFakeTimers();

			mockQueryWithVal(initialSalt);
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should return cached salt within TTL", async () => {
			const saltManager = new SaltManager({
				env: "production",
				nearProvider: {} as providers.Provider,
			});

			const salt1 = await saltManager.getCachedSalt();
			await vi.advanceTimersByTimeAsync(SALT_TTL_MS / 2);

			const newSalt = 67890;
			mockQueryWithVal(newSalt);

			const salt2 = await saltManager.getCachedSalt();

			expect(salt1).toBe(initialSalt);
			expect(salt2).toBe(initialSalt);
			expect(fetchSaltSpy).toHaveBeenCalledTimes(1);
		});

		it("should fetch new salt after TTL expires", async () => {
			const saltManager = new SaltManager({
				env: "production",
				nearProvider: {} as providers.Provider,
			});

			await saltManager.getCachedSalt();
			await vi.advanceTimersByTimeAsync(SALT_TTL_MS + 1);

			const expected = 67890;
			mockQueryWithVal(expected);

			const salt2 = await saltManager.getCachedSalt();

			expect(salt2).toBe(expected);
			expect(fetchSaltSpy).toHaveBeenCalledTimes(2);
		});

		it("should deduplicate concurrent requests", async () => {
			const saltManager = new SaltManager({
				env: "production",
				nearProvider: {} as providers.Provider,
			});

			const [salt1, salt2, salt3] = await Promise.all([
				saltManager.getCachedSalt(),
				saltManager.getCachedSalt(),
				saltManager.getCachedSalt(),
			]);

			expect(salt1).toBe(initialSalt);
			expect(salt2).toBe(initialSalt);
			expect(salt3).toBe(initialSalt);
			expect(fetchSaltSpy).toHaveBeenCalledTimes(1);
		});

		it("should handle fetch errors", async () => {
			const err = "Some network error";
			fetchSaltSpy.mockRejectedValue(new Error(err));

			const saltManager = new SaltManager({
				env: "production",
				nearProvider: {} as providers.Provider,
			});

			await expect(saltManager.getCachedSalt()).rejects.toThrow(err);
		});
	});
});

function mockQueryWithVal(val: number) {
	fetchSaltSpy.mockImplementation(async function (this: any) {
		const salt = val;
		this.currentSalt = salt;
		this.lastFetchTime = Date.now();
		return salt;
	});
}

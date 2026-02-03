import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	SALT_TTL_MS,
	SaltManager,
	StaticSaltManager,
} from "../intents/salt-manager";
import type { providers } from "near-api-js";

import {
	configsByEnvironment,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";

const initialSalt = Uint8Array.from([1, 2, 3, 4]);

describe("SaltManager", () => {
	describe("fetching salt from contract", () => {
		it("should fetch salt on first call", async () => {
			const nearProvider = nearFailoverRpcProvider({
				urls: PUBLIC_NEAR_RPC_URLS,
			});

			const saltManager = new SaltManager({
				envConfig: configsByEnvironment.production,
				nearProvider,
			});

			vi.spyOn(saltManager, "fetchAndCache");

			const salt = await saltManager.getCachedSalt();

			expect(salt.length).toBe(4);
			expect(saltManager.fetchAndCache).toHaveBeenCalledTimes(1);
		});
	});

	describe("unit tests with mocks", () => {
		beforeEach(() => {
			vi.clearAllMocks();
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should return cached salt within TTL", async () => {
			const saltManager = new SaltManager({
				envConfig: configsByEnvironment.production,
				nearProvider: {} as providers.Provider,
			});
			mockQueryWithVal(saltManager, initialSalt);

			const salt1 = await saltManager.getCachedSalt();
			await vi.advanceTimersByTimeAsync(SALT_TTL_MS / 2);

			const newSalt = new Uint8Array([6, 7, 8, 9, 0]);
			mockQueryWithVal(saltManager, newSalt);

			const salt2 = await saltManager.getCachedSalt();

			expect(salt1).toBe(initialSalt);
			expect(salt2).toBe(initialSalt);
			expect(saltManager.fetchAndCache).toHaveBeenCalledTimes(1);
		});

		it("should fetch new salt after TTL expires", async () => {
			const saltManager = new SaltManager({
				envConfig: configsByEnvironment.production,
				nearProvider: {} as providers.Provider,
			});
			mockQueryWithVal(saltManager, initialSalt);

			await saltManager.getCachedSalt();
			await vi.advanceTimersByTimeAsync(SALT_TTL_MS + 1);

			const expected = new Uint8Array([6, 7, 8, 9, 0]);
			mockQueryWithVal(saltManager, expected);

			const salt2 = await saltManager.getCachedSalt();

			expect(salt2).toBe(expected);
			expect(saltManager.fetchAndCache).toHaveBeenCalledTimes(2);
		});

		it("should deduplicate concurrent requests", async () => {
			const saltManager = new SaltManager({
				envConfig: configsByEnvironment.production,
				nearProvider: {} as providers.Provider,
			});
			mockQueryWithVal(saltManager, initialSalt);

			const [salt1, salt2, salt3] = await Promise.all([
				saltManager.getCachedSalt(),
				saltManager.getCachedSalt(),
				saltManager.getCachedSalt(),
			]);

			expect(salt1).toBe(initialSalt);
			expect(salt2).toBe(initialSalt);
			expect(salt3).toBe(initialSalt);
			expect(saltManager.fetchAndCache).toHaveBeenCalledTimes(1);
		});

		it("should handle fetch errors", async () => {
			const saltManager = new SaltManager({
				envConfig: configsByEnvironment.production,
				nearProvider: {} as providers.Provider,
			});

			const err = "Some network error";
			vi.spyOn(saltManager, "fetchAndCache").mockRejectedValue(new Error(err));

			await expect(saltManager.getCachedSalt()).rejects.toThrow(err);
		});
	});
});

function mockQueryWithVal(saltManager: SaltManager, val: Uint8Array) {
	// Do not double `vi.spyOn`, because it implicitly clears mock calls
	(vi.isMockFunction(saltManager.fetchAndCache)
		? vi.mocked(saltManager.fetchAndCache)
		: vi.spyOn(saltManager, "fetchAndCache")
	).mockImplementation(async function (this: SaltManager) {
		const salt = val;
		this.currentSalt = salt;
		// @ts-expect-error It's private but still needed for the test
		this.lastFetchTime = Date.now();
		return salt;
	});
}

describe("StaticSaltManager", () => {
	it("returns the configured salt", async () => {
		const saltManager = new StaticSaltManager("01020304");

		const salt = await saltManager.getCachedSalt();

		expect(Array.from(salt)).toEqual([1, 2, 3, 4]);
	});

	it("refresh returns the same salt", async () => {
		const saltManager = new StaticSaltManager("aabbccdd");

		const salt1 = await saltManager.getCachedSalt();
		const salt2 = await saltManager.refresh();

		expect(salt1).toBe(salt2);
	});

	it("rejects invalid salt length", () => {
		expect(() => new StaticSaltManager("0102")).toThrow(
			/Invalid salt length: 2, expected 4/,
		);
		expect(() => new StaticSaltManager("0102030405")).toThrow(
			/Invalid salt length: 5, expected 4/,
		);
	});

	it("rejects invalid hex", () => {
		expect(() => new StaticSaltManager("zzzz")).toThrow();
	});
});

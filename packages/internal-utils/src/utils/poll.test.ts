import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	poll,
	POLL_PENDING,
	PollTimeoutError,
	type CompletionStats,
} from "./poll";

describe("poll()", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const stats: CompletionStats = {
		p50: 10_000,
		p90: 30_000,
		p99: 60_000,
	};

	it("returns immediately when fn resolves on first call", async () => {
		const fn = vi.fn().mockResolvedValue("result");

		const promise = poll(fn, { stats });

		await expect(promise).resolves.toBe("result");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("polls until fn returns non-POLL_PENDING value", async () => {
		const fn = vi
			.fn()
			.mockResolvedValueOnce(POLL_PENDING)
			.mockResolvedValueOnce(POLL_PENDING)
			.mockResolvedValue("done");

		const promise = poll(fn, { stats });

		// First call returns POLL_PENDING, wait HOT interval (1s) since elapsed < p50
		await vi.advanceTimersByTimeAsync(1_000);
		// Second call returns POLL_PENDING, wait HOT interval again
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(promise).resolves.toBe("done");
		expect(fn).toHaveBeenCalledTimes(3);
	});

	it("throws PollTimeoutError when p99 exceeded", async () => {
		const fn = vi.fn().mockResolvedValue(POLL_PENDING);

		// Use short intervals to avoid long waits
		const shortStats: CompletionStats = {
			p50: 100,
			p90: 200,
			p99: 500,
		};

		// maxInterval=100 forces all intervals to be 100ms
		const promise = poll(fn, {
			stats: shortStats,
			minInterval: 50,
			maxInterval: 100,
		});

		// Catch to prevent unhandled rejection warning
		promise.catch(() => {});

		// Each iteration: poll + sleep(100ms)
		// t=0: poll, sleep 100ms
		// t=100: poll, sleep 100ms
		// t=200: poll, sleep 100ms
		// t=300: poll, sleep 100ms
		// t=400: poll, sleep 100ms
		// t=500: check elapsed >= p99, throw
		await vi.advanceTimersByTimeAsync(600);

		await expect(promise).rejects.toBeInstanceOf(PollTimeoutError);
	});

	it("respects AbortSignal cancellation", async () => {
		const controller = new AbortController();
		const fn = vi.fn().mockResolvedValue(POLL_PENDING);

		const promise = poll(fn, { stats, signal: controller.signal });

		// First poll returns POLL_PENDING, abort during sleep
		await vi.advanceTimersByTimeAsync(1);
		controller.abort(new Error("cancelled"));

		await expect(promise).rejects.toEqual(new Error("cancelled"));
	});

	it("polls aggressively in HOT phase (0 → p50)", async () => {
		const fn = vi
			.fn()
			.mockResolvedValueOnce(POLL_PENDING)
			.mockResolvedValue("done");

		const promise = poll(fn, { stats });

		// In HOT phase (elapsed < p50), interval is 1s
		await vi.advanceTimersByTimeAsync(1_000);

		await expect(promise).resolves.toBe("done");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("uses different intervals per phase", async () => {
		// Track when each call happens
		const callTimes: number[] = [];
		let callCount = 0;
		const fn = vi.fn().mockImplementation(() => {
			callTimes.push(Date.now());
			callCount++;
			// Return done after several calls spanning phases
			if (callCount >= 6) return Promise.resolve("done");
			return Promise.resolve(POLL_PENDING);
		});

		// Set up stats so we go through phases
		const customStats: CompletionStats = {
			p50: 2_000, // HOT: 0-2s (1s intervals)
			p90: 5_000, // COOLING: 2-5s (3s intervals)
			p99: 30_000,
		};

		const promise = poll(fn, { stats: customStats });

		// Advance through phases:
		// Call 1 at t=0, HOT interval=1s
		// Call 2 at t=1s, HOT interval=1s
		// Call 3 at t=2s, COOLING interval=3s (now past p50)
		// Call 4 at t=5s, COLD interval=10s (now past p90)
		// Call 5 at t=15s, COLD interval=10s
		// Call 6 at t=25s -> done
		await vi.advanceTimersByTimeAsync(1_000); // to call 2
		await vi.advanceTimersByTimeAsync(1_000); // to call 3
		await vi.advanceTimersByTimeAsync(3_000); // to call 4
		await vi.advanceTimersByTimeAsync(10_000); // to call 5
		await vi.advanceTimersByTimeAsync(10_000); // to call 6

		await expect(promise).resolves.toBe("done");

		// Calculate intervals between calls
		const intervals = callTimes.slice(1).map((t, i) => {
			const prev = callTimes[i];
			if (prev === undefined) throw new Error("Missing call time");
			return t - prev;
		});

		// Verify phase transitions
		expect(intervals[0]).toBe(1_000); // HOT
		expect(intervals[1]).toBe(1_000); // HOT
		expect(intervals[2]).toBe(3_000); // COOLING
		expect(intervals[3]).toBe(10_000); // COLD
	});

	it("clamps interval to maxInterval", async () => {
		const fn = vi
			.fn()
			.mockResolvedValueOnce(POLL_PENDING)
			.mockResolvedValue("done");

		const promise = poll(fn, {
			stats,
			minInterval: 100,
			maxInterval: 500,
		});

		// HOT default is 1s, but maxInterval clamps to 500ms
		// (minInterval must be <= maxInterval for clamping to work)
		await vi.advanceTimersByTimeAsync(500);

		await expect(promise).resolves.toBe("done");
		expect(fn).toHaveBeenCalledTimes(2);
	});
});

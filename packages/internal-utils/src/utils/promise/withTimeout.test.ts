import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("resolves if data is settled before given timeout", async () => {
		const defer = createDefer();
		const p = withTimeout(() => defer.promise, { timeout: 2000 });

		defer.resolve("data");
		await expect(p).resolves.toEqual("data");
	});

	it("rejects after given timeout with default error", async () => {
		const defer = createDefer();
		const p = withTimeout(() => defer.promise, { timeout: 2000 });

		vi.advanceTimersByTime(2000);

		await expect(p).rejects.toEqual(new Error("timed out"));
	});

	it("rejects after given timeout with given error instance", async () => {
		const defer = createDefer();
		const err = new Error("custom error");
		const p = withTimeout(() => defer.promise, {
			timeout: 2000,
			errorInstance: err,
		});

		vi.advanceTimersByTime(2000);

		await expect(p).rejects.toBe(err);
	});

	it("rejects after given timeout with given error instance (signal = true)", async () => {
		const defer = createDefer();
		const err = new Error("custom error");
		const p = withTimeout(
			({ signal }) => {
				signal?.addEventListener(
					"abort",
					() => {
						defer.reject(signal?.reason);
					},
					{ once: true },
				);

				return defer.promise;
			},
			{
				timeout: 2000,
				errorInstance: err,
				signal: true,
			},
		);

		vi.advanceTimersByTime(2000);

		await expect(p).rejects.toBe(err);
	});

	it("passes through regular abort error", async () => {
		const abortCtrl = new AbortController();
		abortCtrl.abort();

		const p = withTimeout(
			async () => {
				abortCtrl.signal.throwIfAborted();
			},
			{ timeout: 2000 },
		);

		await expect(p).rejects.toBe(abortCtrl.signal.reason);
	});
});

function createDefer<T>() {
	let resolve: (v: T) => void;
	let reject: (v: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	// @ts-expect-error Functions are defined
	return { promise, resolve, reject };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError } from "../errors/request";
import { request } from "./request";

describe("request", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects with TimeoutError after 10 sec", async () => {
		const p = request({
			url: "https://postman-echo.com/get",
		});
		vi.advanceTimersByTime(10000);
		await expect(p).rejects.toBeInstanceOf(TimeoutError);
	});

	it("rejects with abort error", async () => {
		const abortCtrl = new AbortController();
		abortCtrl.abort();
		const p = request({
			url: "https://postman-echo.com/get",
			fetchOptions: {
				signal: abortCtrl.signal,
			},
		});
		vi.advanceTimersByTime(10000);
		await expect(p).rejects.toBe(abortCtrl.signal.reason);
	});

	it("rejects by timeout even if signal isn't aborted", async () => {
		const abortCtrl = new AbortController();
		const p = request({
			url: "https://postman-echo.com/get",
			fetchOptions: {
				signal: abortCtrl.signal,
			},
		});
		vi.advanceTimersByTime(10000);
		await expect(p).rejects.toBeInstanceOf(TimeoutError);
	});
});

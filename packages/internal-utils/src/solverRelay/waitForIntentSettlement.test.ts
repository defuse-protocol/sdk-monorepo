import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/setup";
import { waitForIntentSettlement } from "./waitForIntentSettlement";
import type { GetStatusResponse } from "./solverRelayHttpClient";
import { IntentSettlementError } from "./errors/intentSettlement";

describe("waitForIntentSettlement()", () => {
	it("calls onTxHashKnown callback when tx hash seen", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", async () => {
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "TX_BROADCASTED",
						intent_hash: "foo",
						data: { hash: "bar" },
					},
				} satisfies GetStatusResponse);
			}),
		);

		const fn = vi.fn();
		const controller = new AbortController();

		const promise = waitForIntentSettlement({
			intentHash: "foo",
			signal: controller.signal,
			onTxHashKnown: fn,
		});

		await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
		expect(fn).toHaveBeenCalledWith("bar");

		controller.abort();
		await expect(promise).rejects.toThrow();
	});

	it("calls onTxHashKnown callback once", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", function* () {
				yield HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "TX_BROADCASTED",
						intent_hash: "foo",
						data: { hash: "bar" },
					},
				} satisfies GetStatusResponse);

				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "SETTLED",
						intent_hash: "foo",
						data: { hash: "bar" },
					},
				} satisfies GetStatusResponse);
			}),
		);

		const fn = vi.fn();

		await waitForIntentSettlement({
			intentHash: "foo",
			signal: AbortSignal.timeout(5000),
			onTxHashKnown: fn,
		});

		expect(fn).toHaveBeenCalledOnce();
	});

	it("returns txHash and intentHash when settled", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", () => {
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "SETTLED",
						intent_hash: "intent123",
						data: { hash: "tx456" },
					},
				} satisfies GetStatusResponse);
			}),
		);

		const result = await waitForIntentSettlement({
			intentHash: "intent123",
		});

		expect(result).toEqual({
			txHash: "tx456",
			intentHash: "intent123",
		});
	});

	it("continues polling on transient HTTP errors", async () => {
		let requestCount = 0;
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", () => {
				requestCount++;
				if (requestCount === 1) {
					return HttpResponse.error();
				}
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "SETTLED",
						intent_hash: "foo",
						data: { hash: "bar" },
					},
				} satisfies GetStatusResponse);
			}),
		);

		const result = await waitForIntentSettlement({
			intentHash: "foo",
		});

		expect(requestCount).toBe(2);
		expect(result).toEqual({
			txHash: "bar",
			intentHash: "foo",
		});
	});

	it("throws IntentSettlementError when settlement fails on-chain", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", () => {
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						status: "NOT_FOUND_OR_NOT_VALID",
						intent_hash: "intent123",
						status_details: "FAILED",
						data: { hash: "failedTx456" },
					},
				} satisfies GetStatusResponse);
			}),
		);

		await expect(
			waitForIntentSettlement({ intentHash: "intent123" }),
		).rejects.toThrow(IntentSettlementError);
	});
});

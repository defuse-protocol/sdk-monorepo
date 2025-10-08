import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/setup";
import { waitForIntentSettlement } from "./waitForIntentSettlement";
import type { GetStatusResponse } from "./solverRelayHttpClient";

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

		void waitForIntentSettlement({
			intentHash: "foo",
			signal: AbortSignal.timeout(2000),
			onTxHashKnown: fn,
		});

		await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
		expect(fn).toHaveBeenCalledWith("bar");
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

		await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
		expect(fn).toHaveBeenCalledOnce();
	});
});

import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/setup";
import { publishIntents } from "./publishIntents";
import type { PublishIntentsResponse } from "./solverRelayHttpClient/types";
import {
	RelayPublishError,
	RelayPublishRejectedError,
	RelayPublishResultUnknownError,
} from "./utils/parseFailedPublishError";

describe("publishIntents()", () => {
	it("returns rejected error for failed relay publish response", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", () => {
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					result: {
						intent_hashes: [],
						status: "FAILED",
						reason: "unknown relay failure",
					},
				} satisfies PublishIntentsResponse);
			}),
		);

		const result = await publishIntents({
			quote_hashes: [],
			signed_datas: [],
		});

		const err = result.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toBeInstanceOf(RelayPublishRejectedError);
		expect(err).toHaveProperty("code", "UNKNOWN_ERROR");
	});

	it("returns result unknown error when publish result cannot be confirmed", async () => {
		server.use(
			http.post("https://solver-relay-v2.chaindefuser.com/rpc", () => {
				return HttpResponse.json({
					id: "dontcare",
					jsonrpc: "2.0",
					error: {
						code: -32000,
						message: "relay unavailable",
					},
				});
			}),
		);

		const result = await publishIntents({
			quote_hashes: [],
			signed_datas: [],
		});

		const err = result.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toBeInstanceOf(RelayPublishResultUnknownError);
	});
});

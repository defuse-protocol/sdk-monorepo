import { describe, expect, it, vi } from "vitest";
import { RpcRequestError } from "../errors/request";
import { publishIntents } from "./publishIntents";
import * as solverRelayClient from "./solverRelayHttpClient";
import { RelayPublishError } from "./utils/parseFailedPublishError";

describe("publishIntents()", () => {
	it("returns auth error when relay responds with Unauthorized RPC code", async () => {
		vi.spyOn(solverRelayClient, "publishIntents").mockRejectedValueOnce(
			new RpcRequestError({
				body: {
					id: "dontcare",
					jsonrpc: "2.0",
					method: "publish_intents",
					params: [],
				},
				error: { code: -32001, message: "Unauthorized" },
				url: "https://solver-relay-v2.chaindefuser.com/rpc",
			}),
		);

		const result = await publishIntents(
			{
				quote_hashes: [],
				signed_datas: [],
			},
			{},
		);

		const err = result.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "AUTH_CONFIG_ERROR");
		expect(err.details).toContain("x-api-key");
	});

	it("should return UNKNOWN_ERROR", async () => {
		vi.spyOn(solverRelayClient, "publishIntents").mockResolvedValueOnce({
			status: "FAILED",
			intent_hashes: [],
			reason: "something went wrong",
		});

		const a = await publishIntents(
			{
				quote_hashes: [],
				signed_datas: [],
			},
			{},
		);

		const err = a.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "UNKNOWN_ERROR");
	});
});

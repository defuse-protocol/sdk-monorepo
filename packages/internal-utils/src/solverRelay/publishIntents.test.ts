import { describe, expect, it, vi } from "vitest";
import { HttpRequestError } from "../errors/request";
import { publishIntents } from "./publishIntents";
import * as solverRelayClient from "./solverRelayHttpClient";
import { RelayPublishError } from "./utils/parseFailedPublishError";

describe("publishIntents()", () => {
	it("returns auth error when relay responds with 403", async () => {
		vi.spyOn(solverRelayClient, "publishIntents").mockRejectedValueOnce(
			new HttpRequestError({
				status: 403,
				url: "https://solver-relay-v2.chaindefuser.com/rpc",
				details: "Forbidden",
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
			id: "dontcare",
			jsonrpc: "2.0",
			result: {
				status: "FAILED",
				intent_hashes: [],
				reason: "something went wrong",
			},
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

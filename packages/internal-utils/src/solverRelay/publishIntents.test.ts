import { RpcRequestError } from "../errors/request";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as solverRelayHttpClient from "./solverRelayHttpClient";
import { publishIntents } from "./publishIntents";
import { RelayPublishError } from "./utils/parseFailedPublishError";

vi.mock("./solverRelayHttpClient", () => ({
	publishIntents: vi.fn(),
}));

const publishIntentsMock = vi.mocked(solverRelayHttpClient.publishIntents);

describe("publishIntents()", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns UNKNOWN_ERROR when relay returns non-mapped failure reason", async () => {
		publishIntentsMock.mockResolvedValueOnce({
			intent_hashes: [],
			status: "FAILED",
			reason: "unknown relay failure",
		});

		const a = await publishIntents({
			quote_hashes: [],
			signed_datas: [],
		});

		const err = a.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "UNKNOWN_ERROR");
	});

	it("throws RpcRequestError with code 401 when relay rejects with auth error", async () => {
		publishIntentsMock.mockRejectedValueOnce(
			new RpcRequestError({
				body: { method: "publish_intents" },
				error: { code: 401, message: "Unauthorized" },
				url: "https://solver-relay-v2.chaindefuser.com/rpc",
			}),
		);

		await expect(
			publishIntents({
				quote_hashes: [],
				signed_datas: [],
			}),
		).rejects.toBeInstanceOf(RpcRequestError);
	});

	it("keeps wrapping non-auth transport failures as NETWORK_ERROR", async () => {
		publishIntentsMock.mockRejectedValueOnce(new Error("socket closed"));

		const result = await publishIntents({
			quote_hashes: [],
			signed_datas: [],
		});
		const err = result.unwrapErr();

		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "NETWORK_ERROR");
	});
});

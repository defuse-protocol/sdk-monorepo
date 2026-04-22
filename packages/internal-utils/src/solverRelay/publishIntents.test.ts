import { describe, expect, it } from "vitest";
import { publishIntents } from "./publishIntents";
import { RelayPublishError } from "./utils/parseFailedPublishError";

describe("publishIntents()", () => {
	it("returns auth error when JWT is missing", async () => {
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
		expect(err.details).toContain("solverRelayApiKey or Authorization header");
	});

	it("should return UNKNOWN_ERROR", async () => {
		const a = await publishIntents(
			{
				quote_hashes: [],
				signed_datas: [],
			},
			{ solverRelayApiKey: "test-jwt" },
		);

		const err = a.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "UNKNOWN_ERROR");
	});
});

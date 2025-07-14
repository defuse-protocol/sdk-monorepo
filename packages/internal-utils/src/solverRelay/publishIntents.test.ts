import { describe, expect, it } from "vitest";
import { publishIntents } from "./publishIntents";
import { RelayPublishError } from "./utils/parseFailedPublishError";

describe("publishIntents()", () => {
	it("should return UNKNOWN_ERROR", async () => {
		const a = await publishIntents({
			quote_hashes: [],
			signed_datas: [],
		});

		const err = a.unwrapErr();
		expect(err).toBeInstanceOf(RelayPublishError);
		expect(err).toHaveProperty("code", "UNKNOWN_ERROR");
	});
});

import { hex } from "@scure/base";
import { describe, expect, it } from "vitest";
import { encodeCheck } from "./encodeCheck";

describe("encodeCheck", () => {
	it("should encode the public key correctly", () => {
		const publicKey =
			"10696dbddef262febc0f925b1ee571f45699f2676ae017f85368265d4b0dded6";
		const encoded = encodeCheck("accountId", hex.decode(publicKey));
		expect(encoded).toBe(
			"GAIGS3N533ZGF7V4B6JFWHXFOH2FNGPSM5VOAF7YKNUCMXKLBXPNMLVT",
		);
	});
});

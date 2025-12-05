import { describe, expect, it } from "vitest";
import { createWithdrawIntentPrimitive } from "./poa-bridge-utils";

describe("createWithdrawIntentPrimitive", () => {
	it.each([
		["bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"],
		["BITCOINCASH:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"],
	])("strips 'bitcoincash:' prefix from BCH CashAddr address %s", (address) => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:bch.omft.near",
			destinationAddress: address,
			destinationMemo: undefined,
			amount: 1000000n,
		});

		expect(result.memo).toBe(
			"WITHDRAW_TO:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
		);
	});

	it("includes destination memo in withdrawal memo", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:xrp.omft.near",
			destinationAddress: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
			destinationMemo: "12345",
			amount: 1000000n,
		});

		expect(result.memo).toBe(
			"WITHDRAW_TO:rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv:12345",
		);
	});
});

import { describe, expect, it } from "vitest";
import { InvalidDestinationAddressForWithdrawalError } from "../../classes/errors";
import { zeroAddress } from "viem";
import { IntentsBridge } from "./intents-bridge";

describe("DirectBridge", () => {
	describe("validateWithdrawals()", () => {
		it.each(["user.near", "aurora", zeroAddress])(
			"allows EVM and regular addresses",
			async (destinationAddress) => {
				const bridge = new IntentsBridge();

				await expect(
					bridge.validateWithdrawal({
						assetId: "nep141:wrap.near",
						amount: 1n,
						destinationAddress,
					}),
				).resolves.not.toThrow();
			},
		);
		it.each([
			"a", // Invalid NEAR address (less than two characters)
			// Any string with no uppercase is technically a valid NEAR address (if it is at least two characters long)
			// so I leave only one solana address here
			"9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R", // Solana
		])("blocks non NEAR addresses", async (destinationAddress) => {
			const bridge = new IntentsBridge();

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:wrap.near",
					amount: 1n,
					destinationAddress,
				}),
			).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
		});
	});
});

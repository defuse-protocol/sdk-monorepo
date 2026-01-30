import { describe, expect, it } from "vitest";
import { InvalidDestinationAddressForWithdrawalError } from "../../classes/errors";
import { zeroAddress } from "viem";
import { IntentsBridge } from "./intents-bridge";
import { RouteEnum } from "../../constants/route-enum";

describe("IntentsBridge", () => {
	describe("createWithdrawalIntents()", () => {
		it("includes memo in transfer intent when destinationMemo is provided", async () => {
			const bridge = new IntentsBridge();
			const intents = await bridge.createWithdrawalIntents({
				withdrawalParams: {
					assetId: "nep141:wrap.near",
					amount: 1000n,
					destinationAddress: "receiver.near",
					destinationMemo: "test-memo-123",
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
					underlyingFees: { [RouteEnum.InternalTransfer]: null },
				},
			});

			expect(intents).toHaveLength(1);
			expect(intents[0]).toEqual({
				intent: "transfer",
				receiver_id: "receiver.near",
				tokens: { "nep141:wrap.near": "1000" },
				memo: "test-memo-123",
			});
		});

		it("sets memo to undefined when destinationMemo is not provided", async () => {
			const bridge = new IntentsBridge();
			const intents = await bridge.createWithdrawalIntents({
				withdrawalParams: {
					assetId: "nep141:wrap.near",
					amount: 500n,
					destinationAddress: "receiver.near",
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
					underlyingFees: { [RouteEnum.InternalTransfer]: null },
				},
			});

			expect(intents).toHaveLength(1);
			expect(intents[0]).toEqual({
				intent: "transfer",
				receiver_id: "receiver.near",
				tokens: { "nep141:wrap.near": "500" },
				memo: undefined,
			});
		});
	});

	describe("validateWithdrawal()", () => {
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
				).resolves.toBeUndefined();
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

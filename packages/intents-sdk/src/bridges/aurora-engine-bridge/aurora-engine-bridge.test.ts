import { describe, expect, it } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { createVirtualChainRoute } from "../../lib/route-config-factory";
import { AuroraEngineBridge } from "./aurora-engine-bridge";
import { zeroAddress } from "viem";

describe("AuroraEngineBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			"nep141:wrap.near",
		])("supports NEP-141 if routeConfig passed", async (tokenId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createVirtualChainRoute("", null),
				}),
			).resolves.toBe(true);
		});

		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support any if routeConfig not passed", async (tokenId) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

			await expect(
				bridge.supports({
					assetId: tokenId,
				}),
			).resolves.toBe(false);
		});

		it.each([
			"invalid_string",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not NEP-141 token",
			async (assetId) => {
				const bridge = new AuroraEngineBridge({
					env: "production",
					nearProvider: {} as any,
				});

				await expect(
					bridge.supports({
						assetId: assetId,
						routeConfig: createVirtualChainRoute("", null),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
	describe("validateWithdrawal()", () => {
		it.each([zeroAddress])(
			"allows EVM addresses",
			async (destinationAddress) => {
				const bridge = new AuroraEngineBridge({
					env: "production",
					nearProvider: {} as any,
				});

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
			"example.near", // NEAR
			"18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j", // Bitcoin
			"9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R", // Solana
			"D86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPP", // Doge
			"rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv", // XRPL
			"t3cFfPt1Bcvgez9ZbMBFWeZsskxTkPzGCow", // Zcash
			"TGNZdiQV31H3JvTtC1yH6yuipnqs6LN2Jv", // TRON
			"EQC8YkFdI7PYqD0Ph3ZrZqL1e4aU5RZzXJ9cJmQKzF1h_2bL", // TON
			"0x3a5e9d40e8bb62a7f6f8b6d934a1e42a7a2f5cc1cb122c1b9a8d2f6cb09a8712", // SUI
			"GAXQC6TWRKQ4TK7OVADU2DQMXHFYUDHGO6JIIIHLDD7RTBHYHXPSNUTV", // Stellar
			"0xbc3557a52bcac15d470e6ffa421eeea105baffd8471d6aa2c0238380f363ccd3", // Aptos
			"addr1qxg5fnc2dfssnhzygvkqzzy2fcqcph533ek58jngqksaqjwwk2uhs32lj8zh62fq5zdeawrshdfp23t5vcm538glyn6sqngmem", // Cardano
		])("blocks non EVM addresses", async (destinationAddress) => {
			const bridge = new AuroraEngineBridge({
				env: "production",
				nearProvider: {} as any,
			});

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

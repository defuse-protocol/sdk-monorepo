import { describe, expect, it } from "vitest";
import { PoaBridge } from "./poa-bridge";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { createPoaBridgeRoute } from "../../lib/route-config-factory";
import { Chains } from "../../lib/caip2";
import { zeroAddress } from "viem";

describe("PoaBridge", () => {
	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
		])("supports `omft.near` tokens", async (tokenId) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(true);
			await expect(
				bridge.supports({
					assetId: tokenId,
					routeConfig: createPoaBridgeRoute(Chains.Bitcoin),
				}),
			).resolves.toBe(true);
		});

		it.each([
			"nep141:wrap.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])("doesn't support not `omft.near` tokens", async (tokenId) => {
			const bridge = new PoaBridge({ env: "production" });

			await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(false);
		});

		it.each(["nep141:bitcoin.omft.near", "nep141:unknown.omft.near"])(
			"throws UnsupportedAssetIdError if misspelled POA token",
			async (assetId) => {
				const bridge = new PoaBridge({ env: "production" });

				await expect(bridge.supports({ assetId })).rejects.toThrow(
					UnsupportedAssetIdError,
				);

				// It throws even if routeConfig is provided.
				await expect(
					bridge.supports({
						assetId,
						routeConfig: createPoaBridgeRoute(Chains.Arbitrum),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);

		it.each([
			"invalid_string",
			"nep141:wrap.near",
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		])(
			"throws UnsupportedAssetIdError if routeConfig passed, but assetId is not POA token",
			async (assetId) => {
				const bridge = new PoaBridge({ env: "production" });

				await expect(
					bridge.supports({
						assetId,
						routeConfig: createPoaBridgeRoute(Chains.Bitcoin),
					}),
				).rejects.toThrow(UnsupportedAssetIdError);
			},
		);
	});
	describe("validateWithdrawals()", () => {
		it.each([
			{
				assetId:
					"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
				destinationAddress: zeroAddress,
			}, // UDSC Ethereum
			{
				assetId:
					"nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
				destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
			}, // UDSC Solana
			{
				assetId:
					"nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near",
				destinationAddress:
					"0x3a5e9d40e8bb62a7f6f8b6d934a1e42a7a2f5cc1cb122c1b9a8d2f6cb09a8712",
			}, // UDSC Sui
			{
				assetId: "nep141:zec.omft.near",
				destinationAddress: "t3cFfPt1Bcvgez9ZbMBFWeZsskxTkPzGCow",
			}, // Zcash
			{
				assetId:
					"nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
				destinationAddress: "TGNZdiQV31H3JvTtC1yH6yuipnqs6LN2Jv",
			}, // USDT tron
			{
				assetId: "nep141:btc.omft.near",
				destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			}, // BTC
			{
				assetId: "nep141:xrp.omft.near",
				destinationAddress: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
			}, // XRP
			{
				assetId: "nep141:doge.omft.near",
				destinationAddress: "D86DwJpYsyV7nTP2ib5qdwGsb2Tj7LgzPP",
			}, // Doge
			{
				assetId: "nep141:cardano.omft.near",
				destinationAddress:
					"addr1qxg5fnc2dfssnhzygvkqzzy2fcqcph533ek58jngqksaqjwwk2uhs32lj8zh62fq5zdeawrshdfp23t5vcm538glyn6sqngmem",
			}, // Cardano
		])("allows correct addresses", async ({ assetId, destinationAddress }) => {
			const bridge = new PoaBridge({
				env: "production",
			});

			await expect(
				bridge.validateWithdrawal({
					amount: 50000000000n,
					assetId,
					destinationAddress,
				}),
			).resolves.not.toThrow();
		});
		it.each([
			{
				assetId:
					"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
				destinationAddress: "test.near",
			}, // UDSC Ethereum
			{
				assetId:
					"nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near",
				destinationAddress: "test.near",
			}, // UDSC Solana
			{
				assetId:
					"nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near",
				destinationAddress: zeroAddress,
			}, // UDSC Sui
			{
				assetId: "nep141:zec.omft.near",
				destinationAddress: "TGNZdiQV31H3JvTtC1yH6yuipnqs6LN2Jv",
			}, // Zcash
			{
				assetId:
					"nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
				destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
			}, // USDT tron
			{
				assetId: "nep141:btc.omft.near",
				destinationAddress: "TGNZdiQV31H3JvTtC1yH6yuipnqs6LN2Jv",
			}, // BTC
			{ assetId: "nep141:xrp.omft.near", destinationAddress: zeroAddress }, // XRP
			{
				assetId: "nep141:doge.omft.near",
				destinationAddress: "9FfbHZxQZX3J3oVRjuZZ1gygpViwz7rU1cqAC2kkDe3R",
			}, // Doge
			{
				assetId: "nep141:cardano.omft.near",
				destinationAddress:
					"0x3a5e9d40e8bb62a7f6f8b6d934a1e42a7a2f5cc1cb122c1b9a8d2f6cb09a8712",
			}, // Cardano
		])(
			"blocks non corresponding addresses",
			async ({ assetId, destinationAddress }) => {
				const bridge = new PoaBridge({
					env: "production",
				});

				await expect(
					bridge.validateWithdrawal({
						assetId,
						amount: 50000000000n,
						destinationAddress,
					}),
				).rejects.toThrow(InvalidDestinationAddressForWithdrawalError);
			},
		);
	});
});

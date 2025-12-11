import { poaBridge } from "@defuse-protocol/internal-utils";
import { zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { Chains } from "../../lib/caip2";
import { createPoaBridgeRoute } from "../../lib/route-config-factory";
import { PoaBridge } from "./poa-bridge";

vi.mock("@defuse-protocol/internal-utils", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("@defuse-protocol/internal-utils")>();
	return {
		...original,
		poaBridge: {
			...original.poaBridge,
			httpClient: {
				...original.poaBridge.httpClient,
				getWithdrawalStatus: vi.fn(),
			},
		},
	};
});

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

	describe("validateWithdrawal()", () => {
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
			// BCH tests commented out until POA Bridge API supports BCH
			// {
			// 	assetId: "nep141:bch.omft.near",
			// 	destinationAddress: "qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
			// }, // BCH CashAddr
			// {
			// 	assetId: "nep141:bch.omft.near",
			// 	destinationAddress: "1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu",
			// }, // BCH Legacy
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
			).resolves.toBeUndefined();
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
			// BCH test commented out until POA Bridge API supports BCH
			// {
			// 	assetId: "nep141:bch.omft.near",
			// 	destinationAddress: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
			// }, // BCH - wrong prefix (BTC SegWit)
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

	describe("createWithdrawalIdentifier()", () => {
		it("derives landing chain from asset", () => {
			const bridge = new PoaBridge({ env: "production" });

			const descriptor = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "tx-hash", accountId: "test.near" },
			});

			expect(descriptor.landingChain).toBe(Chains.Bitcoin);
			expect(descriptor.index).toBe(0);
		});
	});

	describe("describeWithdrawal()", () => {
		it("returns completed status with tx hash when withdrawal is complete", async () => {
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [
					{
						status: "COMPLETED",
						data: {
							tx_hash: "near-tx-hash",
							transfer_tx_hash: "dest-tx-hash",
							chain: "btc",
							defuse_asset_identifier: "nep141:btc.omft.near",
							near_token_id: "btc.omft.near",
							decimals: 8,
							amount: 100000,
							account_id: "test.near",
							address: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
							created: "2024-01-01T00:00:00Z",
						},
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "dest-tx-hash",
			});
		});

		it("returns pending status when withdrawal not found", async () => {
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [],
			});

			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });
		});

		it("returns pending status when withdrawal status is PENDING", async () => {
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [
					{
						status: "PENDING",
						data: {
							tx_hash: "near-tx-hash",
							transfer_tx_hash: null,
							chain: "btc",
							defuse_asset_identifier: "nep141:btc.omft.near",
							near_token_id: "btc.omft.near",
							decimals: 8,
							amount: 100000,
							account_id: "test.near",
							address: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
							created: "2024-01-01T00:00:00Z",
						},
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({ status: "pending" });
		});

		it("matches withdrawal by assetId, not by index", async () => {
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [
					{
						status: "COMPLETED",
						data: {
							tx_hash: "near-tx-hash",
							transfer_tx_hash: "other-tx-hash",
							chain: "eth",
							defuse_asset_identifier: "nep141:eth.omft.near",
							near_token_id: "eth.omft.near",
							decimals: 18,
							amount: 1000000,
							account_id: "test.near",
							address: zeroAddress,
							created: "2024-01-01T00:00:00Z",
						},
					},
					{
						status: "COMPLETED",
						data: {
							tx_hash: "near-tx-hash",
							transfer_tx_hash: "btc-tx-hash",
							chain: "btc",
							defuse_asset_identifier: "nep141:btc.omft.near",
							near_token_id: "btc.omft.near",
							decimals: 8,
							amount: 100000,
							account_id: "test.near",
							address: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
							created: "2024-01-01T00:00:00Z",
						},
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Bitcoin,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "btc-tx-hash",
			});
		});
	});
});

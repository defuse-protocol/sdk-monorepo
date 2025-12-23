import { poaBridge } from "@defuse-protocol/internal-utils";
import { zeroAddress } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	InvalidDestinationAddressForWithdrawalError,
	MinWithdrawalAmountError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { Chains } from "../../lib/caip2";
import {
	createHotBridgeRoute,
	createPoaBridgeRoute,
} from "../../lib/route-config-factory";
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
				getSupportedTokens: vi.fn(),
			},
		},
	};
});

describe("PoaBridge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default mock for getSupportedTokens
		vi.mocked(poaBridge.httpClient.getSupportedTokens).mockResolvedValue({
			tokens: [],
		});
	});

	describe("supports()", () => {
		it.each([
			"nep141:btc.omft.near",
			"nep141:sol.omft.near",
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

		it.each(["nep141:sol.omft.near"])(
			"doesn't support `omft.near` tokens that can be routed to omni bridge when routeMigratedPoaTokensThroughOmniBridge = true",
			async (tokenId) => {
				const bridge = new PoaBridge({
					env: "production",
					routeMigratedPoaTokensThroughOmniBridge: true,
				});

				await expect(bridge.supports({ assetId: tokenId })).resolves.toBe(
					false,
				);
			},
		);

		it.each(["nep141:sol.omft.near"])(
			"support `omft.near` tokens that can be routed to omni bridge when routeMigratedPoaTokensThroughOmniBridge = true only when route config is specified",
			async (tokenId) => {
				const bridge = new PoaBridge({
					env: "production",
					routeMigratedPoaTokensThroughOmniBridge: true,
				});

				await expect(
					bridge.supports({
						assetId: tokenId,
						routeConfig: createPoaBridgeRoute(Chains.Solana),
					}),
				).resolves.toBe(true);
			},
		);

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

		it("returns false when routeConfig is for different bridge", async () => {
			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.supports({
				assetId: "nep141:btc.omft.near",
				routeConfig: createHotBridgeRoute(Chains.TON),
			});

			expect(result).toBe(false);
		});
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

		it("caches getSupportedTokens responses", async () => {
			vi.mocked(poaBridge.httpClient.getSupportedTokens).mockResolvedValue({
				tokens: [
					{
						intents_token_id: "nep141:btc.omft.near",
						min_withdrawal_amount: "1000",
						standard: "",
						near_token_id: "",
						asset_name: "",
						decimals: 0,
						min_deposit_amount: "",
						withdrawal_fee: "",
						defuse_asset_identifier: "",
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			// Call validateWithdrawal twice with the same asset
			await bridge.validateWithdrawal({
				assetId: "nep141:btc.omft.near",
				amount: 5000n,
				destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			});

			await bridge.validateWithdrawal({
				assetId: "nep141:btc.omft.near",
				amount: 5000n,
				destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
			});

			// getSupportedTokens should only be called once due to caching
			expect(poaBridge.httpClient.getSupportedTokens).toHaveBeenCalledTimes(1);
		});

		it("throws MinWithdrawalAmountError when amount is below minimum", async () => {
			vi.mocked(poaBridge.httpClient.getSupportedTokens).mockResolvedValue({
				tokens: [
					{
						intents_token_id: "nep141:btc.omft.near",
						min_withdrawal_amount: "10000",
						standard: "",
						near_token_id: "",
						asset_name: "",
						decimals: 0,
						min_deposit_amount: "",
						withdrawal_fee: "",
						defuse_asset_identifier: "",
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:btc.omft.near",
					amount: 5000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
				}),
			).rejects.toThrow(MinWithdrawalAmountError);
		});

		it("passes validation when amount meets minimum", async () => {
			vi.mocked(poaBridge.httpClient.getSupportedTokens).mockResolvedValue({
				tokens: [
					{
						intents_token_id: "nep141:btc.omft.near",
						min_withdrawal_amount: "10000",
						standard: "",
						near_token_id: "",
						asset_name: "",
						decimals: 0,
						min_deposit_amount: "",
						withdrawal_fee: "",
						defuse_asset_identifier: "",
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			await expect(
				bridge.validateWithdrawal({
					assetId: "nep141:btc.omft.near",
					amount: 10000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
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

			const wid = bridge.createWithdrawalIdentifier({
				withdrawalParams: {
					assetId: "nep141:btc.omft.near",
					amount: 100000n,
					destinationAddress: "18HNgVKMwjNjYWey68FZUV7R4pmyojuv2j",
					feeInclusive: false,
				},
				index: 0,
				tx: { hash: "tx-hash", accountId: "test.near" },
			});

			expect(wid.landingChain).toBe(Chains.Bitcoin);
			expect(wid.index).toBe(0);
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

		it("returns failed status when withdrawal status is not PENDING or COMPLETED", async () => {
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [
					{
						// @ts-expect-error - Even though this is not a valid status, it should still be handled correctly
						status: "REFUNDED",
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

			expect(result).toEqual({
				status: "failed",
				reason: "REFUNDED",
			});
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

		it("matches withdrawal by near_token_id when defuse_asset_identifier differs from assetId format", async () => {
			// Regression test: POA API returns defuse_asset_identifier in chain-native format
			// (e.g., "zec:mainnet:native") which differs from assetId format ("nep141:zec.omft.near").
			// Matching must use near_token_id, not defuse_asset_identifier.
			vi.mocked(poaBridge.httpClient.getWithdrawalStatus).mockResolvedValue({
				withdrawals: [
					{
						status: "COMPLETED",
						data: {
							tx_hash: "near-tx-hash",
							transfer_tx_hash: "zec-tx-hash",
							chain: "zec:mainnet",
							defuse_asset_identifier: "zec:mainnet:native",
							near_token_id: "zec.omft.near",
							decimals: 8,
							amount: 474270,
							account_id: "test.near",
							address: "native",
							created: "2024-01-01T00:00:00Z",
						},
					},
				],
			});

			const bridge = new PoaBridge({ env: "production" });

			const result = await bridge.describeWithdrawal({
				landingChain: Chains.Zcash,
				index: 0,
				withdrawalParams: {
					assetId: "nep141:zec.omft.near",
					amount: 474270n,
					destinationAddress: "t1abc123",
					feeInclusive: false,
				},
				tx: { hash: "near-tx-hash", accountId: "test.near" },
			});

			expect(result).toEqual({
				status: "completed",
				txHash: "zec-tx-hash",
			});
		});
	});
});

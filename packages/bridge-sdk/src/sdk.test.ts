import { zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
	FeeExceedsAmountError,
	MinWithdrawalAmountError,
	UnsupportedDestinationMemoError,
} from "./classes/errors";
import { createIntentSignerViem } from "./intents";
import {
	createInternalTransferRoute,
	createNearWithdrawalRoute,
} from "./lib/route-config-factory";
import { BridgeSDK } from "./sdk";

const intentSigner = createIntentSignerViem(
	privateKeyToAccount(generatePrivateKey()),
);

describe.concurrent("poa_bridge", () => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 1500n,
			quote: null,
		});
	});

	it("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: true,
			},
		});

		await expect(fee).rejects.toThrow(FeeExceedsAmountError);
	});

	it("createWithdrawalIntents(): returns intents array", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 100_000_000n, // 1.0
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
			},
		});

		await expect(intents).resolves.toEqual([
			{
				amount: "100001500",
				intent: "ft_withdraw",
				memo: "WITHDRAW_TO:0x0000000000000000000000000000000000000000",
				receiver_id: "btc.omft.near",
				token: "btc.omft.near",
			},
		]);

		const intents2 = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 100_000_000n, // 1.0
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: true,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
			},
		});

		await expect(intents2).resolves.toEqual([
			{
				amount: "100000000",
				intent: "ft_withdraw",
				memo: "WITHDRAW_TO:0x0000000000000000000000000000000000000000",
				receiver_id: "btc.omft.near",
				token: "btc.omft.near",
			},
		]);
	});

	it("createWithdrawalIntents(): rejects when not meet min_withdrawal_amount", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
			},
		});

		await expect(intents).rejects.toThrow(MinWithdrawalAmountError);
	});
});

describe.concurrent("hot_bridge", () => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
			},
		});

		await expect(fee).resolves.toEqual({
			amount: expect.any(BigInt),
			quote: {
				amount_in: expect.any(String),
				amount_out: expect.any(String),
				defuse_asset_identifier_in:
					"nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				defuse_asset_identifier_out:
					"nep245:v2_1.omni.hot.tg:137_11111111111111111111",
				expiration_time: expect.any(String),
				quote_hash: expect.any(String),
			},
		});
	});

	it("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: true,
			},
		});

		await expect(fee).rejects.toThrow(FeeExceedsAmountError);
	});

	it("createWithdrawalIntents(): returns intents array", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 1662n,
			quote: {
				defuse_asset_identifier_in:
					"nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				defuse_asset_identifier_out:
					"nep245:v2_1.omni.hot.tg:137_11111111111111111111",
				amount_in: "1662",
				amount_out: "6600000024640000",
				expiration_time: "2025-07-22T03:52:23.747Z",
				quote_hash: "cHgzmF7GMpVrec83a7bJ6j3jYUtqHnqp583R2Yh36um",
			},
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
			},
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				diff: {
					"nep245:v2_1.omni.hot.tg:137_11111111111111111111":
						"6600000024640000",
					"nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L": "-1662",
				},
				intent: "token_diff",
				referral: "",
			},
			{
				amounts: ["1", "6600000024640000"],
				intent: "mt_withdraw",
				msg: expect.stringMatching(
					/{"receiver_id":"11111111111111111111","amount_native":"6600000024640000","block_number":\d+}/,
				),
				receiver_id: "bridge-refuel.hot.tg",
				token: "v2_1.omni.hot.tg",
				token_ids: [
					"137_qiStmoQJDQPTebaPjgx5VBxZv6L",
					"137_11111111111111111111",
				],
			},
		]);
	});

	describe.concurrent("stellar", () => {
		it("estimateWithdrawalFee(): returns fee", async () => {
			const sdk = new BridgeSDK({ referral: "", intentSigner });

			const fee = sdk.estimateWithdrawalFee({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress: zeroAddress,
					destinationMemo: undefined,
					feeInclusive: false,
				},
			});

			await expect(fee).resolves.toEqual({
				amount: expect.any(BigInt),
				quote: null,
			});
		});

		it.skip("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
			const sdk = new BridgeSDK({ referral: "", intentSigner });

			const fee = sdk.estimateWithdrawalFee({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress: zeroAddress,
					destinationMemo: undefined,
					feeInclusive: true,
				},
			});

			await expect(fee).rejects.toThrow(FeeExceedsAmountError);
		});

		it("createWithdrawalIntents(): returns intents array", async () => {
			const sdk = new BridgeSDK({ referral: "", intentSigner });

			const intents = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress:
						"GCITNLN5SCIYD5XCLVZZORBIBOR7SBAOSUWWP6S636ZLELGXZHOE3RLU",
					destinationMemo: undefined,
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
				},
			});

			await expect(intents).resolves.toEqual([
				{
					amounts: ["1"],
					intent: "mt_withdraw",
					msg: expect.stringMatching(
						/{"receiver_id":"1114wxgAxsZMgciovmoCpRmNCtLu7KVkNZnS7VYz9HSmwCs6dwdsjAeHgbn","amount_native":"0","block_number":\d+}/,
					),
					receiver_id: "bridge-refuel.hot.tg",
					token: "v2_1.omni.hot.tg",
					token_ids: [
						"1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					],
				},
			]);
		});

		it("createWithdrawalIntents(): rejects when destinationMemo is used with Stellar", async () => {
			const sdk = new BridgeSDK({ referral: "", intentSigner });

			const intents = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1000000n,
					destinationAddress:
						"GBVOL67TMUQBGL4TZYNMY3ZQ5WGQYFPFD5VJRWXR72VA33VFNL225PL5",
					destinationMemo: "test-memo",
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
				},
			});

			await expect(intents).rejects.toThrow(UnsupportedDestinationMemoError);
		});
	});
});

describe.concurrent.each([
	{ standard: "nep141", assetId: "nep141:btc.omft.near" },
	{
		standard: "nep245",
		assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
	},
])("internal_transfer $standard", ({ assetId }) => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId,
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: true,
				routeConfig: createInternalTransferRoute(),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 0n,
			quote: null,
		});
	});

	it("createWithdrawalIntents(): returns intents array", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId,
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createInternalTransferRoute(),
			},
			feeEstimation: { amount: 0n, quote: null },
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "transfer",
				receiver_id: "0x0000000000000000000000000000000000000000",
				tokens: { [assetId]: "1" },
			},
		]);
	});
});

describe.concurrent("near_withdrawal", () => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: expect.any(BigInt),
			quote: {
				amount_in: expect.any(String),
				amount_out: "1250000000000000000000",
				defuse_asset_identifier_in: "nep141:btc.omft.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				expiration_time: expect.any(String),
				quote_hash: expect.any(String),
			},
		});
	});

	it("estimateWithdrawalFee(): returns fee without quote for wrap.near with msg", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute("hey"),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 1250000000000000000000n,
			quote: null,
		});
	});

	it("estimateWithdrawalFee(): returns 0 fee for wrap.near", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 0n,
			quote: null,
		});
	});

	it("estimateWithdrawalFee(): returns 0 fee when has storage", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: "intents.near",
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 0n,
			quote: null,
		});
	});

	it("createWithdrawalIntents(): returns intents array with storage swap", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 1000n,
			quote: {
				defuse_asset_identifier_in: "nep141:btc.omft.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "1000",
				amount_out: "1250000000000000000000",
				expiration_time: "2025-07-22T03:52:23.747Z",
				quote_hash: "cHgzmF7GMpVrec83a7bJ6j3jYUtqHnqp583R2Yh36um",
			},
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				diff: {
					"nep141:btc.omft.near": "-1000",
					"nep141:wrap.near": "1250000000000000000000",
				},
				intent: "token_diff",
				referral: "",
			},
			{
				amount: "1",
				intent: "ft_withdraw",
				msg: undefined,
				receiver_id: "0x0000000000000000000000000000000000000000",
				storage_deposit: "1250000000000000000000",
				token: "btc.omft.near",
			},
		]);
	});

	it("createWithdrawalIntents(): returns intents array with msg", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 0n,
			quote: null,
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute("hey"),
			},
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				amount: "1",
				intent: "ft_withdraw",
				msg: "hey",
				receiver_id: "0x0000000000000000000000000000000000000000",
				storage_deposit: null,
				token: "wrap.near",
			},
		]);
	});

	it("createWithdrawalIntents(): returns intents array with native", async () => {
		const sdk = new BridgeSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 0n,
			quote: null,
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				destinationMemo: undefined,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				amount: "1",
				intent: "native_withdraw",
				receiver_id: "0x0000000000000000000000000000000000000000",
			},
		]);
	});
});

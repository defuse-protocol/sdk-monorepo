import { zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { OMNI_BRIDGE_CONTRACT } from "./bridges/omni-bridge/omni-bridge-constants";
import {
	FeeExceedsAmountError,
	MinWithdrawalAmountError,
	TrustlineNotFoundError,
	UnsupportedDestinationMemoError,
} from "./classes/errors";
import { RouteEnum } from "./constants/route-enum";
import { createIntentSignerViem } from "./intents/intent-signer-impl/factories";
import {
	createInternalTransferRoute,
	createNearWithdrawalRoute,
	createOmniBridgeRoute,
} from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import { Chains } from "./lib/caip2";
import { BridgeNameEnum } from "./constants/bridge-name-enum";
import { OmniTokenNormalisationCheckError } from "./bridges/omni-bridge/error";

const intentSigner = createIntentSignerViem(
	privateKeyToAccount(generatePrivateKey()),
);

describe.concurrent("poa_bridge", () => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				feeInclusive: false,
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 1500n,
			quote: null,
		});
	});

	it("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				feeInclusive: true,
			},
		});

		await expect(fee).rejects.toThrow(FeeExceedsAmountError);
	});

	it("createWithdrawalIntents(): returns intents array", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 100_000_000n, // 1.0
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
	it.skip("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				amount: 1n,
				destinationAddress: zeroAddress,
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

	it.skip("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
				amount: 1n,
				destinationAddress: zeroAddress,
				feeInclusive: true,
			},
		});

		await expect(fee).rejects.toThrow(FeeExceedsAmountError);
	});

	it("createWithdrawalIntents(): returns intents array", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

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
		const stellarAddress =
			"GAUA7XL5K54CC2DDGP77FJ2YBHRJLT36CPZDXWPM6MP7MANOGG77PNJU";
		const stellarAddressWithoutTrustline =
			"GCITNLN5SCIYD5XCLVZZORBIBOR7SBAOSUWWP6S636ZLELGXZHOE3RLU";

		// todo: unskip when HOT fixes the issue
		it.skip("estimateWithdrawalFee(): returns fee", async () => {
			const sdk = new IntentsSDK({ referral: "", intentSigner });

			const fee = sdk.estimateWithdrawalFee({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress: stellarAddress,
					feeInclusive: false,
				},
			});

			await expect(fee).resolves.toEqual({
				amount: expect.any(BigInt),
				quote: null,
			});
		});

		it.skip("estimateWithdrawalFee(): rejects when fee is higher than amount", async () => {
			const sdk = new IntentsSDK({ referral: "", intentSigner });

			const fee = sdk.estimateWithdrawalFee({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress: stellarAddress,
					feeInclusive: true,
				},
			});

			await expect(fee).rejects.toThrow(FeeExceedsAmountError);
		});

		it("estimateWithdrawalFee(): rejects when no trustline", async () => {
			const sdk = new IntentsSDK({ referral: "", intentSigner });

			const fee = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu",
					amount: 1000000n,
					destinationAddress: stellarAddressWithoutTrustline,
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
				},
			});

			await expect(fee).rejects.toThrow(TrustlineNotFoundError);
		});

		it("createWithdrawalIntents(): returns intents array", async () => {
			const sdk = new IntentsSDK({ referral: "", intentSigner });

			const intentsNative = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1n,
					destinationAddress: stellarAddress,
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
				},
			});

			const intentsToken = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu",
					amount: 1n,
					destinationAddress: stellarAddress,
					feeInclusive: false,
				},
				feeEstimation: {
					amount: 0n,
					quote: null,
				},
			});

			await expect(intentsNative).resolves.toEqual([
				{
					amounts: ["1"],
					intent: "mt_withdraw",
					msg: expect.stringMatching(
						/{"receiver_id":"1114wxgAxsZMgcigrJfNL8z1q1fqaZMQaiz1hhPQb4GcFRELffsLeNcoy4i","amount_native":"0","block_number":\d+}/,
					),
					receiver_id: "bridge-refuel.hot.tg",
					token: "v2_1.omni.hot.tg",
					token_ids: [
						"1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					],
				},
			]);

			await expect(intentsToken).resolves.toEqual([
				{
					amounts: ["1"],
					intent: "mt_withdraw",
					msg: expect.stringMatching(
						/{"receiver_id":"1114wxgAxsZMgcigrJfNL8z1q1fqaZMQaiz1hhPQb4GcFRELffsLeNcoy4i","amount_native":"0","block_number":\d+}/,
					),
					receiver_id: "bridge-refuel.hot.tg",
					token: "v2_1.omni.hot.tg",
					token_ids: [
						"1100_111bzQBB65GxAPAVoxqmMcgYo5oS3txhqs1Uh1cgahKQUeTUq1TJu",
					],
				},
			]);
		});

		// todo: unskip when HOT fixes the issue
		it.skip("createWithdrawalIntents(): rejects when destinationMemo is used with Stellar", async () => {
			const sdk = new IntentsSDK({ referral: "", intentSigner });

			const intents = sdk.createWithdrawalIntents({
				withdrawalParams: {
					assetId:
						"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
					amount: 1000000n,
					destinationAddress: stellarAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId,
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId,
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: "intents.near",
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 0n,
			quote: null,
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const feeEstimation = {
			amount: 0n,
			quote: null,
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1n,
				destinationAddress: zeroAddress,
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
	it("createWithdrawalIntents(): should not be overriden by any other bridge", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		// This type of withdrawal is last in priority, so we need to make sure no other
		// bridge could override an explicitly set route config.
		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount: 700n,
				destinationAddress: "hello.near",
				feeInclusive: false,
				routeConfig: {
					route: RouteEnum.NearWithdrawal,
				},
			},
			feeEstimation: {
				amount: 0n,
				quote: null,
			},
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				token: "nbtc.bridge.near",
				receiver_id: "hello.near",
				amount: "700",
				storage_deposit: null,
				msg: undefined,
			},
		]);
	});
});

describe.concurrent("omni_bridge", () => {
	it("estimateWithdrawalFee(): should return fee", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:eth.bridge.near",
				amount: 1000000000000000000n,
				destinationAddress: zeroAddress,
				feeInclusive: false,
			},
		});

		await expect(fee).resolves.toEqual({
			amount: expect.any(BigInt),
			quote: null,
		});
	});

	it("createWithdrawalIntents(): returns intents array with feeInclusive = false", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		const withdrawalParams = {
			assetId: "nep141:eth.bridge.near",
			amount: 1000000000000000000n,
			destinationAddress: zeroAddress,
			feeInclusive: false,
		};
		const feeEstimation = await sdk.estimateWithdrawalFee({
			withdrawalParams,
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				token: "eth.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: String(withdrawalParams.amount + feeEstimation.amount),
				storage_deposit: null,
				msg: JSON.stringify({
					recipient: `eth:${zeroAddress}`,
					fee: feeEstimation.amount.toString(),
					native_token_fee: "0",
				}),
			},
		]);
	});
	it("createWithdrawalIntents(): returns intents array with feeInclusive = true", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		const withdrawalParams = {
			assetId: "nep141:eth.bridge.near",
			amount: 1000000000000000000n,
			destinationAddress: zeroAddress,
			feeInclusive: true,
		};
		const feeEstimation = await sdk.estimateWithdrawalFee({
			withdrawalParams,
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				token: "eth.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: withdrawalParams.amount.toString(),
				storage_deposit: null,
				msg: JSON.stringify({
					recipient: `eth:${zeroAddress}`,
					fee: feeEstimation.amount.toString(),
					native_token_fee: "0",
				}),
			},
		]);
	});

	it("createWithdrawalIntents(): returns intents array with storage swap", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const withdrawalParams = {
			assetId: "nep141:eth.bridge.near",
			amount: 1000000000000000000n,
			destinationAddress: zeroAddress,
			feeInclusive: true,
		};

		const feeEstimation = {
			amount: 356349421707378n,
			quote: {
				defuse_asset_identifier_in: "nep141:eth.bridge.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "1000",
				amount_out: "1250000000000000000000",
				expiration_time: "2025-07-22T03:52:23.747Z",
				quote_hash: "cHgzmF7GMpVrec83a7bJ6j3jYUtqHnqp583R2Yh36um",
			},
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				diff: {
					"nep141:eth.bridge.near": "-1000",
					"nep141:wrap.near": "1250000000000000000000",
				},
				intent: "token_diff",
				referral: "",
			},
			{
				intent: "ft_withdraw",
				token: "eth.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: withdrawalParams.amount.toString(),
				storage_deposit: "1250000000000000000000",
				msg: JSON.stringify({
					recipient: `eth:${zeroAddress}`,
					fee: feeEstimation.amount.toString(),
					native_token_fee: "0",
				}),
			},
		]);
	});

	it("estimateWithdrawalFee(): rejects when amount is lower than fee", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:eth.bridge.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				feeInclusive: true,
			},
		});

		await expect(fee).rejects.toThrow(FeeExceedsAmountError);
	});
	it("validateWithdrawal(): prevents transfers that normalize to zero after decimal adjustment", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		// The NEP-141 token (token.publicailab.near) uses 18 decimals on NEAR,
		// while its Solana equivalent uses 9 decimals.
		// When normalizing from 18 → 9 decimals, any value < 1 * 10^9
		// will be rounded down to zero.
		// we must block such transfers to avoid fund loss.
		const withdrawalParams = {
			assetId: "nep141:token.publicailab.near",
			amount: 999_999_999n,
			destinationAddress: "GHmxsR3YypjSQMVgxM2btNZjeqSumefph4DCVNft7eGN",
			feeInclusive: false,
			routeConfig: createOmniBridgeRoute(Chains.Solana),
		};

		const feeEstimation = await sdk.estimateWithdrawalFee({
			withdrawalParams,
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).rejects.toThrow(OmniTokenNormalisationCheckError);
	});
});

describe("sdk.parseAssetId()", () => {
	it.each([
		[
			"nep141:btc.omft.near",
			{ bridgeName: BridgeNameEnum.Poa, blockchain: Chains.Bitcoin },
		],
		[
			"nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			{ bridgeName: BridgeNameEnum.Poa, blockchain: Chains.Ethereum },
		],
		[
			"nep245:v2_1.omni.hot.tg:137_3hpYoaLtt8MP1Z2GH1U473DMRKgr",
			{ bridgeName: BridgeNameEnum.Hot, blockchain: Chains.Polygon },
		],
		[
			"nep245:v2_1.omni.hot.tg:1117_",
			{ bridgeName: BridgeNameEnum.Hot, blockchain: Chains.TON },
		],
		[
			"nep141:sol.omdep.near",
			{ bridgeName: BridgeNameEnum.Omni, blockchain: Chains.Solana },
		],
		[
			"nep141:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
			{ bridgeName: BridgeNameEnum.Omni, blockchain: Chains.Ethereum },
		],
		[
			"nep141:eth.bridge.near",
			{ bridgeName: BridgeNameEnum.Omni, blockchain: Chains.Ethereum },
		],
		[
			"nep141:wrap.near",
			{ bridgeName: BridgeNameEnum.None, blockchain: Chains.Near },
		],
		/* Even though this is a valid `assetId`, but it's not supported in SDK yet.
		[
			"nep245:intents.near:nep141:wrap.near",
			{ bridgeName: BridgeNameEnum.None, blockchain: Chains.Near },
		],
		*/
	])("returns parsed asset info", (assetId, assetInfo) => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		expect(sdk.parseAssetId(assetId)).toEqual(
			expect.objectContaining(assetInfo),
		);
	});
});

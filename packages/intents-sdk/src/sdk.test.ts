import { zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OMNI_BRIDGE_CONTRACT } from "./bridges/omni-bridge/omni-bridge-constants";
import {
	FeeExceedsAmountError,
	MinWithdrawalAmountError,
	TrustlineNotFoundError,
	UnsupportedDestinationMemoError,
} from "./classes/errors";
import { createIntentSignerViem } from "./intents/intent-signer-impl/factories";
import {
	createInternalTransferRoute,
	createNearWithdrawalRoute,
	createOmniBridgeRoute,
} from "./lib/route-config-factory";
import { IntentsSDK } from "./sdk";
import { Chains } from "./lib/caip2";
import { BridgeNameEnum } from "./constants/bridge-name-enum";
import { InsufficientUtxoForOmniBridgeWithdrawalError } from "./bridges/omni-bridge/error";
import {
	calculateStorageAccountId,
	ChainKind,
	omniAddress,
	OmniBridgeAPI,
} from "omni-bridge-sdk";
import type { FeeEstimation } from "./shared-types";
import { RouteEnum } from "./constants/route-enum";

const intentSigner = createIntentSignerViem({
	signer: privateKeyToAccount(generatePrivateKey()),
});

describe.concurrent("poa_bridge", () => {
	it("estimateWithdrawalFee(): returns fee", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				feeInclusive: false,
			},
		});

		await expect(fee).resolves.toEqual({
			amount: 1500n,
			quote: null,
			underlyingFees: {
				[RouteEnum.PoaBridge]: {
					relayerFee: expect.any(BigInt),
				},
			},
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
				destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				feeInclusive: false,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
				underlyingFees: {
					[RouteEnum.PoaBridge]: {
						relayerFee: 1500n,
					},
				},
			},
		});

		await expect(intents).resolves.toEqual([
			{
				amount: "100001500",
				intent: "ft_withdraw",
				memo: "WITHDRAW_TO:bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				min_gas: "17050000000000",
				receiver_id: "btc.omft.near",
				token: "btc.omft.near",
			},
		]);

		const intents2 = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 100_000_000n, // 1.0
				destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				feeInclusive: true,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
				underlyingFees: {
					[RouteEnum.PoaBridge]: {
						relayerFee: 1500n,
					},
				},
			},
		});

		await expect(intents2).resolves.toEqual([
			{
				amount: "100000000",
				intent: "ft_withdraw",
				memo: "WITHDRAW_TO:bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				min_gas: "17050000000000",
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
				destinationAddress: "bc1qsfq3eat543rzzwargvnjeqjzgl4tatse3mr3lu",
				feeInclusive: false,
			},
			feeEstimation: {
				amount: 1500n,
				quote: null,
				underlyingFees: {
					[RouteEnum.PoaBridge]: {
						relayerFee: 1600n,
					},
				},
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
			underlyingFees: {
				[RouteEnum.HotBridge]: {
					relayerFee: expect.any(BigInt),
				},
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

		const feeEstimation: FeeEstimation = {
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
			underlyingFees: {
				[RouteEnum.HotBridge]: {
					relayerFee: 6600000024640000n,
					blockNumber: 0n,
				},
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
				min_gas: "91300000000000",
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
				underlyingFees: {
					[RouteEnum.HotBridge]: {
						relayerFee: expect.any(BigInt),
					},
				},
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
					underlyingFees: {
						[RouteEnum.HotBridge]: {
							relayerFee: 0n,
							blockNumber: 0n,
						},
					},
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
					underlyingFees: {
						[RouteEnum.HotBridge]: {
							relayerFee: 0n,
							blockNumber: 0n,
						},
					},
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
					underlyingFees: {
						[RouteEnum.HotBridge]: {
							relayerFee: 0n,
							blockNumber: 0n,
						},
					},
				},
			});
			await expect(intentsNative).resolves.toEqual([
				{
					amounts: ["1"],
					intent: "mt_withdraw",
					min_gas: "91300000000000",
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
					min_gas: "91300000000000",
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
					underlyingFees: {
						[RouteEnum.InternalTransfer]: null,
					},
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
			underlyingFees: {
				[RouteEnum.InternalTransfer]: null,
			},
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
			feeEstimation: {
				amount: 0n,
				quote: null,
				underlyingFees: {
					[RouteEnum.InternalTransfer]: null,
				},
			},
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

describe("near_withdrawal", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("estimateWithdrawalFee(): returns fee", async () => {
		using solverRelay = await useMockedSolverRelay();

		// Need to dynamically import because of runtime mocking above
		const { IntentsSDK } = await import("./sdk");

		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const quote = {
			amount_in: "1000",
			amount_out: "1250000000000000000000",
			defuse_asset_identifier_in: "nep141:btc.omft.near",
			defuse_asset_identifier_out: "nep141:wrap.near",
			expiration_time: "",
			quote_hash: "",
		};
		solverRelay.getQuote.mockResolvedValue(quote);

		const fee = await sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:btc.omft.near",
				amount: 1n,
				destinationAddress: zeroAddress,
				feeInclusive: false,
				routeConfig: createNearWithdrawalRoute(),
			},
		});

		expect(fee).toEqual({
			amount: expect.any(BigInt),
			quote: {
				amount_in: "1000",
				amount_out: "1250000000000000000000",
				defuse_asset_identifier_in: "nep141:btc.omft.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				expiration_time: "",
				quote_hash: "",
			},
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 1250000000000000000000n,
				},
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
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 1250000000000000000000n,
				},
			},
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
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 0n,
				},
			},
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
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 0n,
				},
			},
		});
	});

	it("createWithdrawalIntents(): returns intents array with storage swap", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const feeEstimation: FeeEstimation = {
			amount: 1000n,
			quote: {
				defuse_asset_identifier_in: "nep141:btc.omft.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "1000",
				amount_out: "1250000000000000000000",
				expiration_time: "2025-07-22T03:52:23.747Z",
				quote_hash: "cHgzmF7GMpVrec83a7bJ6j3jYUtqHnqp583R2Yh36um",
			},
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 1250000000000000000000n,
				},
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
				min_gas: "17050000000000",
				msg: undefined,
				receiver_id: "0x0000000000000000000000000000000000000000",
				storage_deposit: "1250000000000000000000",
				token: "btc.omft.near",
			},
		]);
	});

	it("createWithdrawalIntents(): returns intents array with msg", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const feeEstimation: FeeEstimation = {
			amount: 0n,
			quote: null,
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 0n,
				},
			},
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
				min_gas: undefined,
				msg: "hey",
				receiver_id: "0x0000000000000000000000000000000000000000",
				storage_deposit: undefined,
				token: "wrap.near",
			},
		]);
	});

	it("createWithdrawalIntents(): returns intents array with native", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const feeEstimation: FeeEstimation = {
			amount: 0n,
			quote: null,
			underlyingFees: {
				[RouteEnum.NearWithdrawal]: {
					storageDepositFee: 0n,
				},
			},
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
				routeConfig: createNearWithdrawalRoute(),
			},
			feeEstimation: {
				amount: 0n,
				quote: null,
				underlyingFees: {
					[RouteEnum.NearWithdrawal]: {
						storageDepositFee: 0n,
					},
				},
			},
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				min_gas: "17050000000000",
				token: "nbtc.bridge.near",
				receiver_id: "hello.near",
				amount: "700",
				storage_deposit: undefined,
				msg: undefined,
			},
		]);
	});
});

describe("omni_bridge", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it("estimateWithdrawalFee(): should return fee", async () => {
		using solverRelay = await useMockedSolverRelay();

		// Need to dynamically import because of runtime mocking above
		const { IntentsSDK } = await import("./sdk");

		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const quote = {
			defuse_asset_identifier_in: "nep141:zec.omft.near",
			defuse_asset_identifier_out: "nep141:wrap.near",
			amount_in: "5",
			amount_out: "7",
			expiration_time: "0",
			quote_hash: "mock-hash",
		};

		solverRelay.getQuote.mockResolvedValueOnce(quote);

		const fee = await sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:zec.omft.near",
				amount: 10000n,
				destinationAddress: "1nc1nerator11111111111111111111111111111111",
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			},
		});

		expect(fee).toEqual({
			amount: 5n,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: expect.any(BigInt),
					storageDepositFee: 0n,
				},
			},
			quote: {
				defuse_asset_identifier_in: "nep141:zec.omft.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "5",
				amount_out: "7",
				expiration_time: "0",
				quote_hash: "mock-hash",
			},
		});
	});

	it("estimateWithdrawalFee(): should return fee without quote for withdrawal of nep141:wrap.near", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:wrap.near",
				amount: 1000000000000000000n,
				destinationAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Solana),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: expect.any(BigInt),
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: expect.any(BigInt),
					storageDepositFee: 0n,
				},
			},
		});
	});

	it("estimateWithdrawalFee(): should return correct fee data for btc with zero relayer fee and without quote", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const fee = sdk.estimateWithdrawalFee({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount: 6700n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
		});

		await expect(fee).resolves.toEqual({
			amount: expect.any(BigInt),
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 0n,
					storageDepositFee: 0n,
					utxoMaxGasFee: expect.any(BigInt),
					utxoProtocolFee: expect.any(BigInt),
				},
			},
		});
	});

	it("createWithdrawalIntents(): returns intents array with feeInclusive = false", async () => {
		const referral = "";
		const sdk = new IntentsSDK({ referral, intentSigner });
		const withdrawalParams = {
			assetId: "nep141:eth.bridge.near",
			amount: 1000000000000000000n,
			destinationAddress: zeroAddress,
			feeInclusive: false,
		};

		const feeEstimation = {
			amount: 22414784010685n,
			quote: {
				defuse_asset_identifier_in: "nep141:eth.bridge.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "22414784010685",
				amount_out: "32692131726749337649152",
				expiration_time: "2025-09-26T06:41:05.827Z",
				quote_hash: "BjYZy7HU41U2a1juMxGG7LLZsqHjadhRnT9pzadC8YZn",
			},
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 32692131726749337649152n,
					storageDepositFee: 0n,
				},
			},
		};

		const recipient = omniAddress(ChainKind.Eth, zeroAddress);
		const actualAmount = withdrawalParams.amount;
		const implicitAccount = calculateStorageAccountId({
			token: "near:eth.bridge.near",
			amount: actualAmount,
			recipient,
			fee: {
				fee: 0n,
				native_fee: BigInt(feeEstimation.quote.amount_out),
			},
			sender: "near:intents.near",
			msg: "",
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "token_diff",
				diff: {
					[feeEstimation.quote.defuse_asset_identifier_in]:
						`-${feeEstimation.quote.amount_in}`,
					[feeEstimation.quote.defuse_asset_identifier_out]:
						feeEstimation.quote.amount_out,
				},
				referral,
			},
			{
				deposit_for_account_id: implicitAccount,
				amount: feeEstimation.quote.amount_out,
				contract_id: OMNI_BRIDGE_CONTRACT,
				intent: "storage_deposit",
			},
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "eth.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient,
					fee: "0",
					native_token_fee: feeEstimation.quote.amount_out,
				}),
			},
		]);
	});

	it("createWithdrawalIntents(): returns valid intents array with feeInclusive = true", async () => {
		const referral = "";
		const sdk = new IntentsSDK({ referral, intentSigner });
		const withdrawalParams = {
			assetId: "nep141:eth.bridge.near",
			amount: 1000000000000000000n,
			destinationAddress: zeroAddress,
			feeInclusive: true,
		};

		const feeEstimation = {
			amount: 22414784010685n,
			quote: {
				defuse_asset_identifier_in: "nep141:eth.bridge.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "22414784010685",
				amount_out: "32692131726749337649152",
				expiration_time: "2025-09-26T06:41:05.827Z",
				quote_hash: "BjYZy7HU41U2a1juMxGG7LLZsqHjadhRnT9pzadC8YZn",
			},
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 32692131726749337649152n,
					storageDepositFee: 0n,
				},
			},
		};

		const recipient = omniAddress(ChainKind.Eth, zeroAddress);
		const actualAmount = withdrawalParams.amount - feeEstimation.amount;
		const implicitAccount = calculateStorageAccountId({
			token: "near:eth.bridge.near",
			amount: actualAmount,
			recipient,
			fee: {
				fee: 0n,
				native_fee: BigInt(feeEstimation.quote.amount_out),
			},
			sender: "near:intents.near",
			msg: "",
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "token_diff",
				diff: {
					[feeEstimation.quote.defuse_asset_identifier_in]:
						`-${feeEstimation.quote.amount_in}`,
					[feeEstimation.quote.defuse_asset_identifier_out]:
						feeEstimation.quote.amount_out,
				},
				referral,
			},
			{
				deposit_for_account_id: implicitAccount,
				amount: feeEstimation.quote.amount_out,
				contract_id: OMNI_BRIDGE_CONTRACT,
				intent: "storage_deposit",
			},
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "eth.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient,
					fee: "0",
					native_token_fee: feeEstimation.quote.amount_out,
				}),
			},
		]);
	});

	it("createWithdrawalIntents(): create a btc utxo withdrawal without token_diff and storage_deposit intents with fee inclusive = false", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: 1000n,
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 0n,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: false,
		});
		const destinationAddress = "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml";
		const withdrawalParams = {
			assetId: "nep141:nbtc.bridge.near",
			amount: 6500n,
			destinationAddress,
			feeInclusive: false,
			routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		const actualAmount =
			withdrawalParams.amount + utxoMaxGasFee + utxoProtocolFee;
		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "nbtc.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient: omniAddress(ChainKind.Btc, destinationAddress),
					fee: "0",
					native_token_fee: "0",
					msg: JSON.stringify({
						MaxGasFee: utxoMaxGasFee.toString(),
					}),
				}),
			},
		]);
	});

	it("createWithdrawalIntents(): create a btc utxo withdrawal without token_diff and storage_deposit intents with fee inclusive = true", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: 1000n,
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 0n,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: false,
		});

		const destinationAddress = "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml";
		const withdrawalParams = {
			assetId: "nep141:nbtc.bridge.near",
			amount: 6500n,
			destinationAddress,
			feeInclusive: true,
			routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		const actualAmount = withdrawalParams.amount;
		await expect(intents).resolves.toEqual([
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "nbtc.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient: omniAddress(ChainKind.Btc, destinationAddress),
					fee: "0",
					native_token_fee: "0",
					msg: JSON.stringify({
						MaxGasFee: utxoMaxGasFee.toString(),
					}),
				}),
			},
		]);
	});

	it("estimateWithdrawalFee(): rejects when amount is lower than fee", async () => {
		using solverRelay = await useMockedSolverRelay();

		// Need to dynamically import because of runtime mocking above
		const { IntentsSDK } = await import("./sdk");
		const { FeeExceedsAmountError } = await import("./classes/errors");

		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const quote = {
			defuse_asset_identifier_in: "nep141:eth.bridge.near",
			defuse_asset_identifier_out: "nep141:wrap.near",
			amount_in: "99",
			amount_out: "7",
			expiration_time: "0",
			quote_hash: "mock-hash",
		};

		solverRelay.getQuote.mockResolvedValueOnce(quote);

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

	it("validateWithdrawal(): prevents transfers that normalize to zero after decimal adjustment and throws MinWithdrawalAmountError", async () => {
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

		const feeEstimation = {
			amount: 9510172421483097730n,
			quote: {
				defuse_asset_identifier_in: "nep141:token.publicailab.near",
				defuse_asset_identifier_out: "nep141:wrap.near",
				amount_in: "9510172421483097730",
				amount_out: "195753412200812731432960",
				expiration_time: "2025-09-26T07:22:24.708Z",
				quote_hash: "BTUmMusz94gpRVaVanpoM1gcyjS2rT3iDpwoyqrSQEG5",
			},
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 195753412200812731432960n,
					storageDepositFee: 0n,
				},
			},
		};

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams,
			feeEstimation,
		});

		await expect(intents).rejects.toThrow(MinWithdrawalAmountError);
	});

	it("validateWithdrawal(): prevents btc utxo transfer to be submitted due to amount lower than allowed by btc connector", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: 1000n,
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 0n,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: false,
		});

		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount: 4000n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
			feeEstimation,
		});

		await expect(intents).rejects.toThrow(MinWithdrawalAmountError);
	});

	it("validateWithdrawal(): prevents btc withdrawal if there is not enough available UTXOs in btc connector", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });

		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: 1000n,
			quote: null,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee: 0n,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: true, // flag that contains the check for available utxo amount
		});
		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount: 40000n,
				destinationAddress: "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml",
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
			feeEstimation,
		});

		await expect(intents).rejects.toThrow(
			InsufficientUtxoForOmniBridgeWithdrawalError,
		);
	});
	it("validateWithdrawal(): calculate btc withdrawal with native relayer fee in case it is turned on and feeInclusive = false", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		using solverRelay = await useMockedSolverRelay();
		const relayerFee = 9000676692078110965760n;
		const quote = {
			amount_in: "2",
			amount_out: relayerFee.toString(),
			defuse_asset_identifier_in: "nep141:nbtc.bridge.near",
			defuse_asset_identifier_out: "nep141:wrap.near",
			expiration_time: "",
			quote_hash: "",
		};
		const amount = 40000n;
		solverRelay.getQuote.mockResolvedValue(quote);
		const recipient = "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml";
		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: utxoMaxGasFee + utxoProtocolFee + BigInt(quote.amount_in),
			quote,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: false,
		});
		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount,
				destinationAddress: recipient,
				feeInclusive: false,
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
			feeEstimation,
		});
		const actualAmount = amount + utxoMaxGasFee + utxoProtocolFee;
		const utxoMsg = JSON.stringify({
			MaxGasFee: utxoMaxGasFee.toString(),
		});
		const implicitAccount = calculateStorageAccountId({
			token: "near:nbtc.bridge.near",
			amount: actualAmount,
			recipient: omniAddress(ChainKind.Btc, recipient),
			fee: {
				fee: 0n,
				native_fee: BigInt(feeEstimation.quote.amount_out),
			},
			sender: "near:intents.near",
			msg: utxoMsg,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "token_diff",
				diff: {
					[feeEstimation.quote.defuse_asset_identifier_in]:
						`-${feeEstimation.quote.amount_in}`,
					[feeEstimation.quote.defuse_asset_identifier_out]:
						feeEstimation.quote.amount_out,
				},
				referral: "",
			},
			{
				deposit_for_account_id: implicitAccount,
				amount: feeEstimation.quote.amount_out,
				contract_id: OMNI_BRIDGE_CONTRACT,
				intent: "storage_deposit",
			},
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "nbtc.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient: omniAddress(ChainKind.Btc, recipient),
					fee: "0",
					native_token_fee: feeEstimation.quote.amount_out,
					msg: utxoMsg,
				}),
			},
		]);
	});
	it("validateWithdrawal(): calculate btc withdrawal with native relayer fee in case it is turned on  and feeInclusive = true", async () => {
		const sdk = new IntentsSDK({ referral: "", intentSigner });
		using solverRelay = await useMockedSolverRelay();
		const relayerFee = 9000676692078110965760n;
		const quote = {
			amount_in: "2",
			amount_out: relayerFee.toString(),
			defuse_asset_identifier_in: "nep141:nbtc.bridge.near",
			defuse_asset_identifier_out: "nep141:wrap.near",
			expiration_time: "",
			quote_hash: "",
		};
		const amount = 40000n;
		solverRelay.getQuote.mockResolvedValue(quote);
		const recipient = "bc1q5deh93tj8lcwuh4c34nxtcydtdnfpvmdfzwdml";
		const utxoMaxGasFee = 500n;
		const utxoProtocolFee = 500n;
		const feeEstimation = {
			amount: utxoMaxGasFee + utxoProtocolFee + BigInt(quote.amount_in),
			quote,
			underlyingFees: {
				[RouteEnum.OmniBridge]: {
					relayerFee,
					storageDepositFee: 0n,
					utxoMaxGasFee,
					utxoProtocolFee,
				},
			},
		};

		vi.spyOn(OmniBridgeAPI.prototype, "getFee").mockResolvedValue({
			native_token_fee: 0n,
			transferred_token_fee: "0",
			gas_fee: utxoMaxGasFee,
			protocol_fee: utxoProtocolFee,
			min_amount: "6400",
			usd_fee: 0.58,
			insufficient_utxo: false,
		});
		const intents = sdk.createWithdrawalIntents({
			withdrawalParams: {
				assetId: "nep141:nbtc.bridge.near",
				amount,
				destinationAddress: recipient,
				feeInclusive: true,
				routeConfig: createOmniBridgeRoute(Chains.Bitcoin),
			},
			feeEstimation,
		});
		// we only remove 2 satoshis here cause they are paid for possible relayerFee and/or storageDeposit
		// utxoProtocolFee and utxoMaxGasFee are taken in transferred token
		const actualAmount = amount - BigInt(quote.amount_in);
		const utxoMsg = JSON.stringify({
			MaxGasFee: utxoMaxGasFee.toString(),
		});
		const implicitAccount = calculateStorageAccountId({
			token: "near:nbtc.bridge.near",
			amount: actualAmount,
			recipient: omniAddress(ChainKind.Btc, recipient),
			fee: {
				fee: 0n,
				native_fee: BigInt(feeEstimation.quote.amount_out),
			},
			sender: "near:intents.near",
			msg: utxoMsg,
		});

		await expect(intents).resolves.toEqual([
			{
				intent: "token_diff",
				diff: {
					[feeEstimation.quote.defuse_asset_identifier_in]:
						`-${feeEstimation.quote.amount_in}`,
					[feeEstimation.quote.defuse_asset_identifier_out]:
						feeEstimation.quote.amount_out,
				},
				referral: "",
			},
			{
				deposit_for_account_id: implicitAccount,
				amount: feeEstimation.quote.amount_out,
				contract_id: OMNI_BRIDGE_CONTRACT,
				intent: "storage_deposit",
			},
			{
				intent: "ft_withdraw",
				min_gas: "37400000000000",
				token: "nbtc.bridge.near",
				receiver_id: OMNI_BRIDGE_CONTRACT,
				amount: actualAmount.toString(),
				storage_deposit: undefined,
				msg: JSON.stringify({
					recipient: omniAddress(ChainKind.Btc, recipient),
					fee: "0",
					native_token_fee: feeEstimation.quote.amount_out,
					msg: utxoMsg,
				}),
			},
		]);
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

/**
 * Use it for easy mocking of `solverRelay.getQuote()`
 */
async function useMockedSolverRelay() {
	// Mock at runtime
	vi.doMock("@defuse-protocol/internal-utils", async (importOriginal) => {
		const actual =
			await importOriginal<typeof import("@defuse-protocol/internal-utils")>();
		return {
			...actual,
			solverRelay: {
				...actual.solverRelay,
				getQuote: vi.fn(),
			},
		};
	});

	// Import the mocked module
	const { solverRelay } = await import("@defuse-protocol/internal-utils");

	return {
		getQuote: vi.mocked(solverRelay.getQuote),
		[Symbol.dispose]() {
			vi.doUnmock("@defuse-protocol/internal-utils");
		},
	};
}

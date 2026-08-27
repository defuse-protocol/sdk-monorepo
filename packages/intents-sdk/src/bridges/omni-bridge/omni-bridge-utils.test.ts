import { describe, expect, it, vi } from "vitest";
import {
	chainKindToCaip2,
	createWithdrawIntentsPrimitive,
	getBridgedToken,
	getAccountOmniStorageBalance,
	getTokenDecimals,
	validateOmniToken,
} from "./omni-bridge-utils";
import {
	caip2ToChainKind,
	deriveOmniWithdrawIntentParams,
	isUtxoChain,
} from "./omni-withdraw-params";
import {
	assert,
	nearFailoverRpcProvider,
	PUBLIC_NEAR_RPC_URLS,
} from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress } from "@omni-bridge/core";
import { Chains } from "../../lib/caip2";
import { RouteEnum } from "../../constants/route-enum";
import type { FeeEstimation } from "../../shared-types";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";

describe("validateOmniToken()", () => {
	it("valid omni bridge token ids", () => {
		for (const assetId of [
			"eth.bridge.near",
			"sol.omft.near",
			"base.omdep.near",
			"arb.omdep.near",
			"foo.omdep.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near",
			"sol-ABC123.omdep.near",
			"arb-ABC123.omdep.near",
			"base-ABC123.omdep.near",
		]) {
			expect(validateOmniToken(assetId)).toBe(true);
		}
	});

	it("invalid omni bridge token ids", () => {
		for (const assetId of [
			"eth.Hellobridge.near",
			"sol-ABC123.test.hello.near",
			"aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridgeomni.near",
			"btc.omft.near",
			"v3_1.omni.hot.tg:56_11111111111111111111",
			"17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", // USDC
		]) {
			expect(validateOmniToken(assetId)).toBe(false);
		}
	});
});

describe("getAccountOmniStorageBalance()", () => {
	it("fetches omni storage balance and parses it successfully", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});
		await expect(
			getAccountOmniStorageBalance(nearProvider, "intents.near"),
		).resolves.toEqual({
			total: expect.any(String),
			available: expect.any(String),
		});
	});
});
describe("getBridgedToken()", () => {
	it("resolves a token from NEAR to SOL directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});
		const nearAddress = "near:token.publicailab.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Sol,
		);
		await expect(result).toBe(
			"sol:AXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
		);
	});
	it("resolves a token from NEAR to ETH directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		// Aurora
		const nearAddress =
			"near:aaaaaa20d9e0e2461697782ef11675f668207961.factory.bridge.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Eth,
		);
		await expect(result).toBe("eth:0xaaaaaa20d9e0e2461697782ef11675f668207961");
	});
	it("resolves a token from NEAR to BASE directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		const nearAddress = "near:wrap.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Base,
		);
		await expect(result).toBe(
			"base:0x02eea354d135d1a912967c2d2a6147deb01ef92e",
		);
	});
	it("resolves a token from NEAR to ARB directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		// Aurora
		const nearAddress = "near:wrap.near";
		const result = await getBridgedToken(
			nearProvider,
			nearAddress,
			ChainKind.Arb,
		);
		await expect(result).toBe("arb:0x02eea354d135d1a912967c2d2a6147deb01ef92e");
	});

	it("returns null for unregistered tokens", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		const invalidAddress = "near:unregistered";
		const result = await getBridgedToken(
			nearProvider,
			invalidAddress,
			ChainKind.Eth,
		);
		expect(result).toBeNull();
	});
});
describe("getTokenDecimals()", () => {
	it("resolves tokens decimals from NEAR to SOL directly", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(
				nearProvider,
				omniAddress(
					ChainKind.Sol,
					"AXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
				),
			),
		).resolves.toEqual({
			decimals: expect.any(Number),
			origin_decimals: expect.any(Number),
		});
	});
	it("returns null for non existing token", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(
				nearProvider,
				omniAddress(
					ChainKind.Sol,
					"XXCp86262ZPfpcV9bmtmtnzmJSL5sD99mCVJD4GR9vS",
				),
			),
		).resolves.toBeNull();
	});

	it("throws for NEAR addresses", async () => {
		const nearProvider = nearFailoverRpcProvider({
			urls: PUBLIC_NEAR_RPC_URLS,
		});

		await expect(
			getTokenDecimals(nearProvider, "near:token.near"),
		).rejects.toThrow("Token decimals cannot be queried using NEAR addresses");
	});
});

describe("caip2ToChainKind()", () => {
	it("maps Ethereum to Eth", () => {
		expect(caip2ToChainKind(Chains.Ethereum)).toBe(ChainKind.Eth);
	});

	it("maps Solana to Sol", () => {
		expect(caip2ToChainKind(Chains.Solana)).toBe(ChainKind.Sol);
	});

	it("maps Bitcoin to Btc", () => {
		expect(caip2ToChainKind(Chains.Bitcoin)).toBe(ChainKind.Btc);
	});

	it("returns null for unsupported chain", () => {
		expect(caip2ToChainKind(Chains.TON)).toBeNull();
	});
});

describe("chainKindToCaip2()", () => {
	it("maps Eth to Ethereum", () => {
		expect(chainKindToCaip2(ChainKind.Eth)).toBe(Chains.Ethereum);
	});

	it("maps Sol to Solana", () => {
		expect(chainKindToCaip2(ChainKind.Sol)).toBe(Chains.Solana);
	});

	it("returns null for unsupported ChainKind", () => {
		expect(chainKindToCaip2(ChainKind.Near)).toBeNull();
	});
});

describe("isUtxoChain()", () => {
	it("returns true for Bitcoin", () => {
		expect(isUtxoChain(ChainKind.Btc)).toBe(true);
	});

	it("returns false for Ethereum", () => {
		expect(isUtxoChain(ChainKind.Eth)).toBe(false);
	});

	it("returns false for Solana", () => {
		expect(isUtxoChain(ChainKind.Sol)).toBe(false);
	});
});

/** The fees of an Omni withdrawal, as `estimateWithdrawalFee` returns them. */
function fees(
	overrides: Partial<{
		storageDepositFee: bigint;
		relayerFee: bigint;
		utxoProtocolFee: bigint;
		utxoMaxGasFee: bigint;
	}> = {},
): FeeEstimation {
	return {
		amount: 0n,
		quote: null,
		underlyingFees: {
			[RouteEnum.OmniBridge]: {
				storageDepositFee: 0n,
				relayerFee: 0n,
				...overrides,
			},
		},
	};
}

describe("createWithdrawIntentsPrimitive()", () => {
	it("creates intent for EVM chain without native fee", () => {
		const result = createWithdrawIntentsPrimitive(
			deriveOmniWithdrawIntentParams({
				assetId: "nep141:eth.bridge.near",
				destinationAddress: "0x1234567890123456789012345678901234567890",
				actualAmount: 1000n,
				omniChainKind: ChainKind.Eth,
				intentsContract: "intents.near",
				feeEstimation: fees(),
			}),
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			intent: "ft_withdraw",
			token: "eth.bridge.near",
			receiver_id: OMNI_BRIDGE_CONTRACT,
			amount: "1000",
		});
	});

	it("includes storage_deposit intent when nativeFee > 0", () => {
		const result = createWithdrawIntentsPrimitive(
			deriveOmniWithdrawIntentParams({
				assetId: "nep141:eth.bridge.near",
				destinationAddress: "0x1234567890123456789012345678901234567890",
				actualAmount: 1000n,
				omniChainKind: ChainKind.Eth,
				intentsContract: "intents.near",
				feeEstimation: fees({ relayerFee: 500n }),
			}),
		);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			intent: "storage_deposit",
			amount: "500",
			contract_id: OMNI_BRIDGE_CONTRACT,
		});
		expect(result[1]).toMatchObject({
			intent: "ft_withdraw",
		});
	});

	it("includes maxGasFee for Bitcoin withdrawals", () => {
		const result = createWithdrawIntentsPrimitive(
			deriveOmniWithdrawIntentParams({
				assetId: "nep141:btc.bridge.near",
				destinationAddress: "bc1qtest",
				actualAmount: 1000n,
				omniChainKind: ChainKind.Btc,
				intentsContract: "intents.near",
				feeEstimation: fees({ utxoMaxGasFee: 100n, utxoProtocolFee: 50n }),
			}),
		);

		expect(result).toHaveLength(1);

		const ftWithdraw = result[0];
		expect(ftWithdraw).toHaveProperty("intent", "ft_withdraw");

		assert(ftWithdraw != null && ftWithdraw.intent === "ft_withdraw"); // typeguard
		assert(typeof ftWithdraw.msg === "string"); // typeguard

		expect(JSON.parse(ftWithdraw.msg)).toHaveProperty(
			"msg",
			'{"MaxGasFee":"100"}',
		);
	});

	it("throws for Bitcoin without utxoMaxGasFee", () => {
		expect(() =>
			createWithdrawIntentsPrimitive(
				deriveOmniWithdrawIntentParams({
					assetId: "nep141:btc.bridge.near",
					destinationAddress: "bc1qtest",
					actualAmount: 1000n,
					omniChainKind: ChainKind.Btc,
					intentsContract: "intents.near",
					feeEstimation: fees(),
				}),
			),
		).toThrow("Invalid Omni Bridge utxo max gas fee");
	});

	it("throws for non NEP-141 assets", () => {
		expect(() =>
			createWithdrawIntentsPrimitive(
				deriveOmniWithdrawIntentParams({
					assetId: "nep245:token.near:1",
					destinationAddress: "0x1234567890123456789012345678901234567890",
					actualAmount: 1000n,
					omniChainKind: ChainKind.Eth,
					intentsContract: "intents.near",
					feeEstimation: fees(),
				}),
			),
		).toThrow("Only NEP-141 is supported");
	});
});

describe("deriveOmniWithdrawIntentParams()", () => {
	const withdrawal = {
		assetId: "nep141:btc.bridge.near",
		destinationAddress: "bc1qtest",
		actualAmount: 1000n,
		omniChainKind: ChainKind.Btc,
		intentsContract: "intents.near",
		feeEstimation: fees({
			relayerFee: 500n,
			utxoMaxGasFee: 100n,
			utxoProtocolFee: 50n,
		}),
	};

	it("gives the values that the SDK writes into its own intents", () => {
		const params = deriveOmniWithdrawIntentParams({
			...withdrawal,
			externalId: "fixed-external-id",
		});

		const intents = createWithdrawIntentsPrimitive(
			deriveOmniWithdrawIntentParams({
				...withdrawal,
				externalId: "fixed-external-id",
			}),
		);

		const [storageDeposit, ftWithdraw] = intents;
		assert(
			storageDeposit != null && storageDeposit.intent === "storage_deposit",
		);
		assert(ftWithdraw != null && ftWithdraw.intent === "ft_withdraw");
		assert(typeof ftWithdraw.msg === "string");

		expect(storageDeposit.deposit_for_account_id).toBe(
			params.storageDepositAccountId,
		);
		expect(JSON.parse(ftWithdraw.msg)).toMatchObject({
			external_id: params.externalId,
			recipient: params.recipient,
			msg: params.msg,
		});
		expect(ftWithdraw.token).toBe(params.tokenAccountId);
	});

	it("uses the external id that you give, so you can calculate two times", () => {
		const first = deriveOmniWithdrawIntentParams({
			...withdrawal,
			externalId: "fixed-external-id",
		});
		const second = deriveOmniWithdrawIntentParams({
			...withdrawal,
			externalId: "fixed-external-id",
		});

		expect(first).toEqual(second);
		expect(first.externalId).toBe("fixed-external-id");
	});

	it("makes a new external id for each withdrawal if you give none", () => {
		const randomUUID = vi
			.spyOn(crypto, "randomUUID")
			.mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
			.mockReturnValueOnce("00000000-0000-4000-8000-000000000002");

		try {
			expect(deriveOmniWithdrawIntentParams(withdrawal).externalId).toBe(
				"00000000-0000-4000-8000-000000000001",
			);
			expect(deriveOmniWithdrawIntentParams(withdrawal).externalId).toBe(
				"00000000-0000-4000-8000-000000000002",
			);
		} finally {
			randomUUID.mockRestore();
		}
	});

	it("gives no storage account if there is no native fee", () => {
		const params = deriveOmniWithdrawIntentParams({
			...withdrawal,
			feeEstimation: fees({ utxoMaxGasFee: 100n, utxoProtocolFee: 50n }),
		});

		expect(params.storageDepositAccountId).toBeNull();
		expect(params.recipient).toBe(
			omniAddress(ChainKind.Btc, withdrawal.destinationAddress),
		);
		expect(params.msg).toBe('{"MaxGasFee":"100"}');
	});
});

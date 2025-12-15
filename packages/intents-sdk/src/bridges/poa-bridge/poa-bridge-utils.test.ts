import { describe, expect, it } from "vitest";
import { Chains } from "../../lib/caip2";
import {
	contractIdToCaip2,
	createWithdrawIntentPrimitive,
	toPoaNetwork,
} from "./poa-bridge-utils";
import { MIN_GAS_AMOUNT } from "./poa-constants";

describe("createWithdrawIntentPrimitive", () => {
	it.each([
		["bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"],
		["BITCOINCASH:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a"],
	])("strips 'bitcoincash:' prefix from BCH CashAddr address %s", (address) => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:bch.omft.near",
			destinationAddress: address,
			destinationMemo: undefined,
			amount: 1000000n,
		});

		expect(result.memo).toBe(
			"WITHDRAW_TO:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a",
		);
	});

	it("includes destination memo in withdrawal memo", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:xrp.omft.near",
			destinationAddress: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
			destinationMemo: "12345",
			amount: 1000000n,
		});

		expect(result.memo).toBe(
			"WITHDRAW_TO:rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv:12345",
		);
	});

	it("creates correct intent structure", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:btc.omft.near",
			destinationAddress: "bc1qtest",
			destinationMemo: undefined,
			amount: 1000000n,
		});

		expect(result).toEqual({
			intent: "ft_withdraw",
			token: "btc.omft.near",
			receiver_id: "btc.omft.near",
			amount: "1000000",
			memo: "WITHDRAW_TO:bc1qtest",
			min_gas: MIN_GAS_AMOUNT,
		});
	});

	it("excludes empty destination memo", () => {
		const result = createWithdrawIntentPrimitive({
			assetId: "nep141:xrp.omft.near",
			destinationAddress: "rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv",
			destinationMemo: "",
			amount: 1000000n,
		});

		expect(result.memo).toBe("WITHDRAW_TO:rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv");
	});
});

describe("toPoaNetwork", () => {
	it.each([
		[Chains.Ethereum, "eth:1"],
		[Chains.Base, "eth:8453"],
		[Chains.Arbitrum, "eth:42161"],
		[Chains.Bitcoin, "btc:mainnet"],
		[Chains.BitcoinCash, "bch:mainnet"],
		[Chains.Solana, "sol:mainnet"],
		[Chains.Dogecoin, "doge:mainnet"],
		[Chains.XRPL, "xrp:mainnet"],
		[Chains.Zcash, "zec:mainnet"],
		[Chains.Gnosis, "eth:100"],
		[Chains.Tron, "tron:mainnet"],
	])("maps %s to %s", (caip2, expected) => {
		expect(toPoaNetwork(caip2)).toBe(expected);
	});

	it("throws for unsupported chain", () => {
		expect(() => toPoaNetwork("unsupported:chain")).toThrow(
			"Unsupported POA Bridge chain",
		);
	});
});

describe("contractIdToCaip2", () => {
	it.each([
		["eth.omft.near", Chains.Ethereum],
		[
			"eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
			Chains.Ethereum,
		],
		["base.omft.near", Chains.Base],
		["arb.omft.near", Chains.Arbitrum],
		["btc.omft.near", Chains.Bitcoin],
		["bch.omft.near", Chains.BitcoinCash],
		["sol.omft.near", Chains.Solana],
		["doge.omft.near", Chains.Dogecoin],
		["xrp.omft.near", Chains.XRPL],
		["zec.omft.near", Chains.Zcash],
		["gnosis.omft.near", Chains.Gnosis],
		["tron.omft.near", Chains.Tron],
		["sui.omft.near", Chains.Sui],
		["aptos.omft.near", Chains.Aptos],
		["cardano.omft.near", Chains.Cardano],
		["ltc.omft.near", Chains.Litecoin],
		["starknet.omft.near", Chains.Starknet],
	])("maps %s to %s", (contractId, expected) => {
		expect(contractIdToCaip2(contractId)).toBe(expected);
	});

	it("throws for unsupported contract", () => {
		expect(() => contractIdToCaip2("unknown.omft.near")).toThrow(
			"Unsupported POA Bridge contractId",
		);
	});
});

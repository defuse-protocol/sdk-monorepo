import { describe, expect, it } from "vitest";
import { Chains } from "../../lib/caip2";
import {
	contractIdToCaip2,
	createWithdrawIntentPrimitive,
	parseStellarAsset,
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
		[Chains.Dogecoin, "doge:mainnet"],
		[Chains.XRPL, "xrp:mainnet"],
		[Chains.Gnosis, "eth:100"],
		[Chains.Tron, "tron:mainnet"],
		[Chains.Movement, "movement:mainnet"],
		[Chains.Plasma, "eth:9745"],
		[Chains.Adi, "eth:36900"],
		[Chains.Hood, "eth:4663"],
		[Chains.Arc, "eth:5042"],
		[Chains.Miden, "miden:mainnet"],
		[Chains.Prl, "prl:mainnet"],
		[Chains.Optimism, "eth:10"],
		[Chains.Monad, "eth:143"],
		[Chains.LayerX, "eth:196"],
		[Chains.Scroll, "eth:534352"],
		[Chains.TON, "ton:mainnet"],
		[Chains.Stellar, "stellar:mainnet"],
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
		["hood.omft.near", Chains.Hood],
		["arc.omft.near", Chains.Arc],
		["miden.omft.near", Chains.Miden],
		["ton.omft.near", Chains.TON],
		["stellar.omft.near", Chains.Stellar],
		[
			"stellar-a27936ea52e99cb99d4f3a2e0b64115bb2baf67c.omft.near",
			Chains.Stellar,
		],
		[
			"op-0x0b2c639c533813f4aa9d7837caf62653d097ff85.omft.near",
			Chains.Optimism,
		],
		[
			"monad-0x754704bc059f8c67012fed69bc8a327a5aafb603.omft.near",
			Chains.Monad,
		],
		[
			"xlayer-0x74b7f16337b8972027f6196a17a631ac6de26d22.omft.near",
			Chains.LayerX,
		],
		[
			"scroll-0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4.omft.near",
			Chains.Scroll,
		],
		["btc.omft.near", Chains.Bitcoin],
		["bch.omft.near", Chains.BitcoinCash],
		["doge.omft.near", Chains.Dogecoin],
		["xrp.omft.near", Chains.XRPL],
		["gnosis.omft.near", Chains.Gnosis],
		["plasma.omft.near", Chains.Plasma],
		["tron.omft.near", Chains.Tron],
		["sui.omft.near", Chains.Sui],
		["movement.omft.near", Chains.Movement],
		["cardano.omft.near", Chains.Cardano],
		["ltc.omft.near", Chains.Litecoin],
		["prl.omft.near", Chains.Prl],
		["adi-0x9cb8142aebbcdc60af7c97af897a67a8f3ca71c2.omft.near", Chains.Adi],
	])("maps %s to %s", (contractId, expected) => {
		expect(contractIdToCaip2(contractId)).toBe(expected);
	});

	it("throws for unsupported contract", () => {
		expect(() => contractIdToCaip2("unknown.omft.near")).toThrow(
			"Unsupported POA Bridge contractId",
		);
	});
});

describe("parseStellarAsset", () => {
	it("parses `<code>:<issuer>` asset", () => {
		expect(
			parseStellarAsset(
				"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
			),
		).toEqual({
			code: "USDC",
			issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
		});
	});

	it.each([
		["GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],
		["USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"],
		["native"],
	])("throws for %s", (asset) => {
		expect(() => parseStellarAsset(asset)).toThrow("Invalid Stellar asset");
	});
});

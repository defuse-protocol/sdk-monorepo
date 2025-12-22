import { Network } from "@hot-labs/omni-sdk";
import { describe, expect, it } from "vitest";
import { Chains } from "../../lib/caip2";
import {
	formatTxHash,
	getFeeAssetIdForChain,
	hotBlockchainInvariant,
	hotNetworkIdToCAIP2,
	toHotNetworkId,
} from "./hot-bridge-utils";

describe("getFeeAssetIdForChain()", () => {
	it("returns native token for BNB", () => {
		expect(getFeeAssetIdForChain(Chains.BNB)).toBe(
			"nep245:v2_1.omni.hot.tg:56_11111111111111111111",
		);
	});

	it("returns native token for TON", () => {
		expect(getFeeAssetIdForChain(Chains.TON)).toBe(
			"nep245:v2_1.omni.hot.tg:1117_",
		);
	});
});

describe("toHotNetworkId()", () => {
	it("maps BNB to correct network ID", () => {
		expect(toHotNetworkId(Chains.BNB)).toBe(Network.Bnb);
	});

	it("maps Monad to mainnet network ID (143)", () => {
		expect(toHotNetworkId(Chains.Monad)).toBe(143);
	});

	it("throws for unsupported chain", () => {
		expect(() => toHotNetworkId(Chains.Bitcoin)).toThrow(
			"is not a valid HOT Bridge blockchain",
		);
	});
});

describe("hotNetworkIdToCAIP2()", () => {
	it("maps BNB network ID to chain", () => {
		expect(hotNetworkIdToCAIP2(String(Network.Bnb))).toBe(Chains.BNB);
	});

	it("maps Monad mainnet network ID (143) to chain", () => {
		expect(hotNetworkIdToCAIP2("143")).toBe(Chains.Monad);
	});

	it("throws for unsupported network ID", () => {
		expect(() => hotNetworkIdToCAIP2("999999")).toThrow(
			"Unsupported HOT Bridge chain = 999999",
		);
	});
});

describe("formatTxHash()", () => {
	it("adds 0x prefix for EVM chains", () => {
		expect(formatTxHash("DEADBEEF", Chains.BNB)).toBe("0xDEADBEEF");
	});

	it("returns unchanged for non-EVM chains", () => {
		expect(formatTxHash("DEADBEEF", Chains.TON)).toBe("DEADBEEF");
	});
});

describe("hotBlockchainInvariant()", () => {
	it("passes for supported chain", () => {
		expect(() => hotBlockchainInvariant(Chains.BNB)).not.toThrow();
	});

	it("throws for unsupported chain", () => {
		expect(() => hotBlockchainInvariant(Chains.Bitcoin)).toThrow(
			"is not a valid HOT Bridge blockchain",
		);
	});
});

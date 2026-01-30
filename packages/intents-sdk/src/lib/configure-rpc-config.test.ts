import { describe, expect, it } from "vitest";
import { HotBridgeEVMChains } from "../bridges/hot-bridge/hot-bridge-chains";
import { Chains } from "./caip2";
import {
	configureEvmRpcUrls,
	configureStellarRpcUrls,
} from "./configure-rpc-config";

describe("configureEvmRpcUrls()", () => {
	const mockDefaultRpcUrls = {
		[Chains.Ethereum]: ["https://eth-mainnet.public.blastapi.io"],
		[Chains.Polygon]: ["https://polygon-mainnet.public.blastapi.io"],
		[Chains.BNB]: ["https://bsc-mainnet.public.blastapi.io"],
		[Chains.Base]: ["https://base-mainnet.public.blastapi.io"],
		[Chains.Arbitrum]: ["https://arbitrum-mainnet.public.blastapi.io"],
		[Chains.Optimism]: ["https://optimism-mainnet.public.blastapi.io"],
		[Chains.Avalanche]: ["https://avalanche-mainnet.public.blastapi.io"],
	};

	const mockSupportedChains = [
		Chains.Polygon,
		Chains.BNB,
		Chains.Optimism,
		Chains.Avalanche,
	];

	it("should configure EVM RPC URLs with defaults only", () => {
		const result = configureEvmRpcUrls(
			mockDefaultRpcUrls,
			{},
			mockSupportedChains,
		);

		expect(result).toEqual({
			137: ["https://polygon-mainnet.public.blastapi.io"],
			56: ["https://bsc-mainnet.public.blastapi.io"],
			10: ["https://optimism-mainnet.public.blastapi.io"],
			43114: ["https://avalanche-mainnet.public.blastapi.io"],
		});
	});

	it("should merge user config with defaults, user takes precedence", () => {
		const userConfig = {
			[Chains.Polygon]: ["https://custom-polygon-rpc.com"],
			[Chains.BNB]: [
				"https://custom-bnb-rpc.com",
				"https://backup-bnb-rpc.com",
			],
		};

		const result = configureEvmRpcUrls(
			mockDefaultRpcUrls,
			userConfig,
			mockSupportedChains,
		);

		expect(result).toEqual({
			137: ["https://custom-polygon-rpc.com"], // User override
			56: ["https://custom-bnb-rpc.com", "https://backup-bnb-rpc.com"], // User override with multiple URLs
			10: ["https://optimism-mainnet.public.blastapi.io"], // Default
			43114: ["https://avalanche-mainnet.public.blastapi.io"], // Default
		});
	});

	it("should only include supported chains", () => {
		const limitedSupported = [Chains.Polygon, Chains.BNB];

		const result = configureEvmRpcUrls(
			mockDefaultRpcUrls,
			{},
			limitedSupported,
		);

		expect(result).toEqual({
			137: ["https://polygon-mainnet.public.blastapi.io"],
			56: ["https://bsc-mainnet.public.blastapi.io"],
		});

		// Should not include unsupported chains
		expect(result[1]).toBeUndefined(); // Ethereum
		expect(result[10]).toBeUndefined(); // Optimism
	});

	it("should work with actual HotBridgeEVMChains", () => {
		const actualDefaultRpcUrls = {
			[Chains.BNB]: ["https://bsc-rpc.publicnode.com"],
			[Chains.Polygon]: ["https://polygon-bor-rpc.publicnode.com"],
			[Chains.Optimism]: ["https://optimism-rpc.publicnode.com"],
			[Chains.Avalanche]: ["https://avalanche-c-chain-rpc.publicnode.com"],
		};

		const result = configureEvmRpcUrls(
			actualDefaultRpcUrls,
			{},
			HotBridgeEVMChains,
		);

		expect(result[56]).toEqual(["https://bsc-rpc.publicnode.com"]);
		expect(result[137]).toEqual(["https://polygon-bor-rpc.publicnode.com"]);
		expect(result[10]).toEqual(["https://optimism-rpc.publicnode.com"]);
		expect(result[43114]).toEqual([
			"https://avalanche-c-chain-rpc.publicnode.com",
		]);
	});

	it("should handle partial user config", () => {
		const userConfig = {
			[Chains.Polygon]: ["https://custom-polygon-rpc.com"],
			// BNB, Optimism, Avalanche will use defaults
		};

		const result = configureEvmRpcUrls(
			mockDefaultRpcUrls,
			userConfig,
			mockSupportedChains,
		);

		expect(result[137]).toEqual(["https://custom-polygon-rpc.com"]);
		expect(result[56]).toEqual(["https://bsc-mainnet.public.blastapi.io"]);
		expect(result[10]).toEqual(["https://optimism-mainnet.public.blastapi.io"]);
		expect(result[43114]).toEqual([
			"https://avalanche-mainnet.public.blastapi.io",
		]);
	});

	it("should throw error when a supported chain has no RPC URLs", () => {
		const badDefaultRpcUrls = {
			[Chains.Polygon]: [], // Empty array should cause error
			[Chains.BNB]: ["https://bsc-mainnet.public.blastapi.io"],
			[Chains.Optimism]: ["https://optimism-mainnet.public.blastapi.io"],
			[Chains.Avalanche]: ["https://avalanche-mainnet.public.blastapi.io"],
		};

		expect(() => {
			configureEvmRpcUrls(badDefaultRpcUrls, {}, [Chains.Polygon, Chains.BNB]);
		}).toThrow("EVM RPC URLs for chain 137 are not provided");
	});

	it("should handle empty supported chains array", () => {
		const result = configureEvmRpcUrls(mockDefaultRpcUrls, {}, []);
		expect(result).toEqual({});
	});

	it("ignores stellar config", () => {
		const limitedSupported = [Chains.Ethereum];

		const result = configureEvmRpcUrls(
			mockDefaultRpcUrls,
			{ [Chains.Stellar]: { soroban: [""], horizon: [""] } },
			limitedSupported,
		);

		expect(result).toEqual({
			1: ["https://eth-mainnet.public.blastapi.io"],
		});
	});
});

describe("configureStellarRpcUrls()", () => {
	const mockDefaultRpcUrls = {
		soroban: ["https://sorobanrpc.com"],
		horizon: ["https://horizonrpc.com"],
	};

	it("ignores other chains", () => {
		const result = configureStellarRpcUrls(mockDefaultRpcUrls, {
			[Chains.Polygon]: ["https://polygonrpc.com"],
		});

		expect(result).toEqual(mockDefaultRpcUrls);
	});

	it("overrides default RPC URLs", () => {
		const result = configureStellarRpcUrls(mockDefaultRpcUrls, {
			[Chains.Stellar]: {
				horizon: ["https://customhorizonrpc.com"],
			},
		});

		expect(result).toEqual({
			soroban: ["https://sorobanrpc.com"],
			horizon: ["https://customhorizonrpc.com"],
		});
	});

	it("throws when empty list provided", () => {
		const fn = () =>
			configureStellarRpcUrls(mockDefaultRpcUrls, {
				[Chains.Stellar]: {
					soroban: ["https://customsorobanrpc.com"],
					horizon: [],
				},
			});

		expect(fn).toThrow("Stellar Horizon RPC URL is not provided");
	});
});

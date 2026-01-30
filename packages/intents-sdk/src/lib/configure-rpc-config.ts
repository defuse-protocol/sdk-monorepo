import {
	assert,
	extractRpcUrls,
	type RpcEndpoint,
} from "@defuse-protocol/internal-utils";
import type { PartialRPCEndpointMap, RPCEndpointMap } from "../shared-types";
import { Chains, getEIP155ChainId } from "./caip2";

/**
 * Configures EVM RPC URLs by merging defaults with user-provided URLs.
 * Extracts plain URL strings for compatibility with external SDKs.
 */
export function configureEvmRpcUrls(
	defaultRpcUrls: Record<string, RpcEndpoint[]>,
	userRpcUrls: PartialRPCEndpointMap | undefined,
	supportedChains: string[],
): Record<number, string[]> {
	const evmRpcUrls: Record<number, string[]> = {};

	for (const caip2 of supportedChains) {
		// User config takes precedence, fall back to defaults
		const endpoints =
			(userRpcUrls?.[caip2 as keyof PartialRPCEndpointMap] as
				| RpcEndpoint[]
				| undefined) ?? defaultRpcUrls[caip2];

		if (endpoints) {
			const chainId = getEIP155ChainId(caip2);
			evmRpcUrls[chainId] = extractRpcUrls(endpoints);
		}
	}

	for (const [chainId, urls] of Object.entries(evmRpcUrls)) {
		assert(
			urls.length > 0,
			`EVM RPC URLs for chain ${chainId} are not provided`,
		);
	}

	return evmRpcUrls;
}

/**
 * Configures Stellar RPC URLs by merging defaults with user-provided URLs.
 * Extracts plain URL strings for compatibility with external SDKs.
 */
export function configureStellarRpcUrls(
	defaultRpcUrls: RPCEndpointMap[typeof Chains.Stellar],
	userRpcUrls: PartialRPCEndpointMap | undefined,
): { soroban: string[]; horizon: string[] } {
	const soroban =
		userRpcUrls?.[Chains.Stellar]?.soroban ?? defaultRpcUrls.soroban;
	const horizon =
		userRpcUrls?.[Chains.Stellar]?.horizon ?? defaultRpcUrls.horizon;

	const stellarRpcUrls = {
		soroban: extractRpcUrls(soroban),
		horizon: extractRpcUrls(horizon),
	};

	assert(
		stellarRpcUrls.soroban.length > 0,
		"Stellar Soroban RPC URL is not provided",
	);
	assert(
		stellarRpcUrls.horizon.length > 0,
		"Stellar Horizon RPC URL is not provided",
	);

	return stellarRpcUrls;
}

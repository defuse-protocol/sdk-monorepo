import { assert } from "@defuse-protocol/internal-utils";
import type { RPCEndpointMap } from "../shared-types";
import { Chains, getEIP155ChainId } from "./caip2";
import { pick } from "./object";

export function configureEvmRpcUrls(
	defaultRpcUrls: Record<string, string[]>,
	userRpcUrls: Partial<RPCEndpointMap> | undefined,
	supportedChains: string[],
): Record<number, string[]> {
	const evmRpcUrls: Record<number, string[]> = Object.fromEntries(
		Object.entries(
			pick(
				Object.assign({}, defaultRpcUrls, userRpcUrls ?? {}),
				supportedChains,
			),
		).map(([caip2, urls]) => [getEIP155ChainId(caip2), urls]),
	);
	for (const [chainId, urls] of Object.entries(evmRpcUrls)) {
		assert(
			urls.length > 0,
			`EVM RPC URLs for chain ${chainId} are not provided`,
		);
	}
	return evmRpcUrls;
}

export function configureStellarRpcUrls(
	defaultRpcUrls: RPCEndpointMap[typeof Chains.Stellar],
	userRpcUrls: Partial<RPCEndpointMap> | undefined,
) {
	const stellarRpcUrls = Object.assign(
		{},
		defaultRpcUrls,
		userRpcUrls?.[Chains.Stellar] ?? {},
	);
	for (const [key, value] of Object.entries(stellarRpcUrls)) {
		assert(value.length > 0, `Stellar RPC URL for ${key} is not provided`);
	}

	return stellarRpcUrls;
}

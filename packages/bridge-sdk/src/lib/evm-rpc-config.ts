import { assert } from "@defuse-protocol/internal-utils";
import { getEIP155ChainId } from "./caip2";
import { pick } from "./object";

export function configureEvmRpcUrls(
	defaultRpcUrls: Record<string, string[]>,
	userRpcUrls: Record<string, string[]> | undefined,
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

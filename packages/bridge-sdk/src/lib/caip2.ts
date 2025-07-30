import { assert } from "@defuse-protocol/internal-utils";

/**
 * CAIP2 identifiers
 */
export const Chains = {
	Bitcoin: "bip122:000000000019d6689c085ae165831e93",
	Ethereum: "eip155:1",
	Base: "eip155:8453",
	Arbitrum: "eip155:42161",
	BNB: "eip155:56",
	Polygon: "eip155:137",
	Near: "near:mainnet",
	Solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
	Tron: "tron:27Lqcw",
	Gnosis: "eip155:100",
	XRPL: "xrpl:0",
	Dogecoin: "bip122:1a91e3dace36e2be3bf030a65679fe82",
	Zcash: "zcash:0",
	Berachain: "eip155:80085",
	TON: "tvm:-239",
	Optimism: "eip155:10",
	Avalanche: "eip155:43114",
	Sui: "sui:mainnet",
	Aptos: "aptos:mainnet",
	Stellar: "stellar:pubnet",
	Cardano: "cip34:1-764824073",
} as const;

export type Chain = (typeof Chains)[keyof typeof Chains];

export function getEIP155ChainId(chain: string): number {
	assert(chain.startsWith("eip155:"), "Chain is not an EIP-155 chain");
	const chainIdStr = chain.slice(7);
	assert(chainIdStr.length > 0, "Chain is not an EIP-155 chain");
	const chainId = Number(chainIdStr);
	assert(!Number.isNaN(chainId), "Chain is not an EIP-155 chain");
	return chainId;
}

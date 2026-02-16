import { assert } from "@defuse-protocol/internal-utils";

/**
 * CAIP2 identifiers
 */
export const Chains = {
	Bitcoin: "bip122:000000000019d6689c085ae165831e93",
	BitcoinCash: "bip122:000000000000000000651ef99cb9fcbe",
	Zcash: "bip122:00040fe8ec8471911baa1db1266ea15d",
	Dogecoin: "bip122:1a91e3dace36e2be3bf030a65679fe82",
	Litecoin: "bip122:12a765e31ffd4059bada1e25190f6e98",
	Ethereum: "eip155:1",
	Optimism: "eip155:10",
	BNB: "eip155:56",
	Gnosis: "eip155:100",
	Polygon: "eip155:137",
	Monad: "eip155:143",
	LayerX: "eip155:196",
	Adi: "eip155:36900",
	Base: "eip155:8453",
	Arbitrum: "eip155:42161",
	Avalanche: "eip155:43114",
	Berachain: "eip155:80085",
	Near: "near:mainnet",
	Solana: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
	Tron: "tron:27Lqcw",
	XRPL: "xrpl:0",
	TON: "tvm:-239",
	Sui: "sui:mainnet",
	Aptos: "aptos:mainnet",
	Stellar: "stellar:pubnet",
	Cardano: "cip34:1-764824073",
	Starknet: "starknet:SN_MAIN",
	Plasma: "eip155:9745",
	Scroll: "eip155:534352",
	Aleo: "aleo:0",
	Dash: "dash:0",
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

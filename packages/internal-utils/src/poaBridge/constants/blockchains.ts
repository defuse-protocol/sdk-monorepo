/**
 * Values are PoA Bridge specific
 * @see https://docs.near-intents.org/near-intents/market-makers/poa-bridge-api
 */
export const PoaBridgeNetworkReference = {
	NEAR: "near:mainnet",
	ETHEREUM: "eth:1",
	BASE: "eth:8453",
	ARBITRUM: "eth:42161",
	BITCOIN: "btc:mainnet",
	SOLANA: "sol:mainnet",
	DOGECOIN: "doge:mainnet",
	XRPLEDGER: "xrp:mainnet",
	ZCASH: "zec:mainnet",
	GNOSIS: "eth:100",
	BERACHAIN: "eth:80094",
	TRON: "tron:mainnet",
	POLYGON: "eth:137",
	BSC: "eth:56",
	TON: "ton:mainnet",
	OPTIMISM: "eth:10",
	AVALANCHE: "eth:43114",
	SUI: "sui:mainnet",
	STELLAR: "stellar:mainnet",
	APTOS: "aptos:mainnet",
} as const;

export const VirtualNetworkReference = {
	TURBOCHAIN: "eth:1313161567",
	TUXAPPCHAIN: "eth:1313161573",
	VERTEX: "eth:1313161587",
	OPTIMA: "eth:1313161569",
	COINEASY: "eth:1313161752",
	AURORA: "eth:1313161554",
} as const;

export const BlockchainEnum = {
	...PoaBridgeNetworkReference,
	...VirtualNetworkReference,
	/* Hyperliquid is only available as a withdrawal destination */
	HYPERLIQUID: "hyperliquid:999",
} as const;

export type BlockchainEnumType =
	(typeof BlockchainEnum)[keyof typeof BlockchainEnum];

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
	BITCOINCASH: "bch:mainnet",
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
	CARDANO: "cardano:mainnet",
	LITECOIN: "ltc:mainnet",
	MONAD: "eth:143",
	LAYERX: "eth:196",
	STARKNET: "starknet:mainnet",
} as const;

export const VirtualNetworkReference = {
	TURBOCHAIN: "eth:1313161567",
	TUXAPPCHAIN: "eth:1313161573",
	VERTEX: "eth:1313161587",
	OPTIMA: "eth:1313161569",
	EASYCHAIN: "eth:1313161752",
	HAKO: "eth:1313161901",
	AURORA: "eth:1313161554",
	AURORA_DEVNET: "eth:1313161834",
} as const;

export const BlockchainEnum = {
	...PoaBridgeNetworkReference,
	...VirtualNetworkReference,
	/* Hyperliquid is only available as a withdrawal destination */
	HYPERLIQUID: "hyperliquid:999",
	/* ADI is operated by HOT bridge */
	ADI: "eth:36900",
} as const;

export type BlockchainEnum =
	(typeof BlockchainEnum)[keyof typeof BlockchainEnum];

export type ChainPrefix =
	| "eth"
	| "near"
	| "sol"
	| "arb"
	| "base"
	| "bnb"
	| "btc"
	| "zec";

export enum ChainKind {
	Eth = 0,
	Near = 1,
	Sol = 2,
	Arb = 3,
	Base = 4,
	Bnb = 5,
	Btc = 6,
	Zcash = 7,
}

export type OmniAddress =
	| `eth:${string}`
	| `near:${string}`
	| `sol:${string}`
	| `arb:${string}`
	| `base:${string}`
	| `btc:${string}`
	| `bnb:${string}`
	| `zec:${string}`;

export interface TokenDecimals {
	decimals: number;
	origin_decimals: number;
}

// Type helpers for EVM chains
export type EVMChainKind =
	| ChainKind.Eth
	| ChainKind.Base
	| ChainKind.Arb
	| ChainKind.Bnb;

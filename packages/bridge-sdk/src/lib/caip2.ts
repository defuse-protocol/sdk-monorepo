export const CAIP2_NETWORK = {
	Bitcoin: "bip122:000000000019d6689c085ae165831e93",
	Ethereum: "eip155:1",
	Base: "eip155:8453",
	Arbitrum: "eip155:42161",
	BNB: "eip155:56",
	Polygon: "eip155:137",
	Near: "near:mainnet",
};

export type CAIP2_NETWORK = (typeof CAIP2_NETWORK)[keyof typeof CAIP2_NETWORK];

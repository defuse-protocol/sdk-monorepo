/**
 * Default EVM RPC endpoints for HOT bridge supported chains
 */
export const PUBLIC_EVM_RPC_URLS: Record<number, string[]> = {
	56: ["https://bsc-rpc.publicnode.com"], // BNB Chain
	137: ["https://polygon-bor-rpc.publicnode.com"], // Polygon
	10: ["https://optimism-rpc.publicnode.com"], // Optimism
	43114: ["https://avalanche-c-chain-rpc.publicnode.com"], // Avalanche
};

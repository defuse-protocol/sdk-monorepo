import type { HotBridgeEVMChain } from "../bridges/hot-bridge/hot-bridge-chains";
import { Chains } from "../lib/caip2";
import type { RPCEndpointMap } from "../shared-types";

/**
 * Default EVM RPC endpoints for HOT bridge supported chains
 */
export const PUBLIC_EVM_RPC_URLS: Record<HotBridgeEVMChain, string[]> = {
	[Chains.BNB]: ["https://bsc-rpc.publicnode.com"],
	[Chains.Polygon]: ["https://polygon-bor-rpc.publicnode.com"],
	[Chains.Optimism]: ["https://optimism-rpc.publicnode.com"],
	[Chains.Avalanche]: ["https://avalanche-c-chain-rpc.publicnode.com"],
};

export const PUBLIC_STELLAR_RPC_URLS: RPCEndpointMap[typeof Chains.Stellar] = {
	soroban: ["https://mainnet.sorobanrpc.com"],
	horizon: ["https://horizon.stellar.org"],
};

import { nearFailoverRpcProvider } from "./utils/failover";

/**
 * NEAR RPC providers list from official docs:
 * https://docs.near.org/api/rpc/providers
 */
export const PUBLIC_NEAR_RPC_URLS = [
	"https://relmn.aurora.dev",
	"https://free.rpc.fastnear.com",
	"https://rpc.mainnet.near.org",
];

export const nearClient = nearFailoverRpcProvider({
	urls: PUBLIC_NEAR_RPC_URLS,
});

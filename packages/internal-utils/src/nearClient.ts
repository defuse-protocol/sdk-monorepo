import { nearFailoverRpcProvider } from "./utils/failover";

/**
 * NEAR RPC providers list from official docs:
 * https://docs.near.org/api/rpc/providers
 */
export const PUBLIC_NEAR_RPC_URLS = [
	"https://near-rpc.defuse.org",
	"https://free.rpc.fastnear.com",
	"https://1rpc.io/near",
	"https://rpc.mainnet.pagoda.co",
	"https://near.lava.build:443",
];

export const nearClient = nearFailoverRpcProvider({
	urls: PUBLIC_NEAR_RPC_URLS,
});

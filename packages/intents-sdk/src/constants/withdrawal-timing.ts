import type { CompletionStats } from "@defuse-protocol/internal-utils";
import type { Chain } from "../lib/caip2";

/**
 * Withdrawal timing p99 values (in seconds) by CAIP-2 chain identifier.
 * Used to derive CompletionStats for chain-aware polling.
 */
const WITHDRAWAL_P99_BY_CHAIN: Partial<Record<Chain, number>> = {
	"eip155:1": 1852, // eth
	"eip155:56": 36, // bsc
	"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": 1387, // solana
	"eip155:8453": 651, // base
	"tron:27Lqcw": 2358, // tron
	"eip155:42161": 928, // arbitrum
	"bip122:000000000019d6689c085ae165831e93": 3656, // bitcoin
	"eip155:137": 410, // polygon
	"xrpl:0": 2276, // xrpledger
	"bip122:00040fe8ec8471911baa1db1266ea15d": 2093, // zcash
	"tvm:-239": 53, // ton
	"near:mainnet": 356, // near
	"bip122:12a765e31ffd4059bada1e25190f6e98": 2385, // litecoin
	"eip155:143": 22, // monad
	"eip155:43114": 657, // avalanche
	"stellar:pubnet": 50, // stellar
	"eip155:10": 23, // optimism
	"bip122:1a91e3dace36e2be3bf030a65679fe82": 1970, // dogecoin
	"sui:mainnet": 752, // sui
	"eip155:80085": 579, // berachain
	"eip155:100": 3308, // gnosis
	"aptos:mainnet": 394, // aptos
	"cip34:1-764824073": 807, // cardano
};

/**
 * Default stats for chains without timing data.
 * Conservative 2-hour timeout with gradual phase transitions.
 */
const DEFAULT_WITHDRAWAL_STATS: CompletionStats = {
	p50: 60_000, // 1 minute
	p90: 600_000, // 10 minutes
	p99: 7_200_000, // 2 hours
};

/**
 * Returns CompletionStats for the given chain.
 * Derives p50/p90 from p99 using reasonable ratios with minimum floors.
 */
export function getWithdrawalStatsForChain(caip2: Chain): CompletionStats {
	const p99Seconds = WITHDRAWAL_P99_BY_CHAIN[caip2];

	if (p99Seconds == null) {
		return DEFAULT_WITHDRAWAL_STATS;
	}

	const p99 = p99Seconds * 1000;

	// Derive p50/p90 from p99 with minimum floors
	// p50: 15% of p99, minimum 5s - aggressive polling phase
	// p90: 50% of p99, minimum 30s - moderate polling phase
	const p50 = Math.max(5_000, p99 * 0.15);
	const p90 = Math.max(30_000, p99 * 0.5);

	return { p50, p90, p99 };
}

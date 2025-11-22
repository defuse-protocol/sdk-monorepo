import { assert } from "@defuse-protocol/internal-utils";
import { Network } from "@hot-labs/omni-sdk";
import { type Chain, Chains } from "../../lib/caip2";
import { type HotBridgeChain, HotBridgeChains } from "./hot-bridge-chains";

// HOT SDK still maps Network.Monad (10143) to their testnet, so force mainnet id.
const MONAD_MAINNET_NETWORK_ID = 143 as Network;

const nativeTokenMapping: Record<HotBridgeChain, string> = {
	[Chains.BNB]: "nep245:v2_1.omni.hot.tg:56_11111111111111111111",
	[Chains.Polygon]: "nep245:v2_1.omni.hot.tg:137_11111111111111111111",
	[Chains.Monad]: "nep245:v2_1.omni.hot.tg:143_11111111111111111111",
	[Chains.TON]: "nep245:v2_1.omni.hot.tg:1117_",
	[Chains.Optimism]: "nep245:v2_1.omni.hot.tg:10_11111111111111111111",
	[Chains.Avalanche]: "nep245:v2_1.omni.hot.tg:43114_11111111111111111111",
	[Chains.Stellar]:
		"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
	[Chains.LayerX]: "nep245:v2_1.omni.hot.tg:196_11111111111111111111",
};

const caip2NetworkIdMapping: Record<HotBridgeChain, Network> = {
	[Chains.BNB]: Network.Bnb,
	[Chains.Polygon]: Network.Polygon,
	[Chains.Monad]: MONAD_MAINNET_NETWORK_ID,
	[Chains.TON]: Network.Ton,
	[Chains.Optimism]: Network.Optimism,
	[Chains.Avalanche]: Network.Avalanche,
	[Chains.Stellar]: Network.Stellar,
	[Chains.LayerX]: Network.Xlayer,
};

const networkIdCAIP2Mapping: Partial<Record<Network, HotBridgeChain>> =
	Object.fromEntries(
		Object.entries(caip2NetworkIdMapping).map(([k, v]) => [v, k]),
	);

export function getFeeAssetIdForChain(caip2: HotBridgeChain): string {
	return nativeTokenMapping[caip2];
}

export function toHotNetworkId(caip2: Chain): Network {
	hotBlockchainInvariant(caip2);
	return caip2NetworkIdMapping[caip2];
}

export function hotNetworkIdToCAIP2(network: string): Chain {
	const mappedChain = networkIdCAIP2Mapping[network as unknown as Network];
	if (mappedChain != null) {
		return mappedChain;
	}

	throw new Error(`Unsupported HOT Bridge chain = ${network}`);
}

/**
 * HOT returns hexified raw bytes. So we need to return more friendly/common string.
 */
export function formatTxHash(txHash: string, caip2: Chain) {
	if (caip2.startsWith("eip155:")) {
		return `0x${txHash}`;
	}
	return txHash;
}

export function hotBlockchainInvariant(
	blockchain: string,
): asserts blockchain is HotBridgeChain {
	assert(
		(HotBridgeChains as readonly string[]).includes(blockchain),
		`${blockchain} is not a valid HOT Bridge blockchain. Supported values: ${HotBridgeChains.join()}`,
	);
}

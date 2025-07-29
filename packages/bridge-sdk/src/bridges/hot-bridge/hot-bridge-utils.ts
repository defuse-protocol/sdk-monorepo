import { Network } from "@hot-labs/omni-sdk";
import { assert } from "../../lib/assert";
import { type Chain, Chains } from "../../lib/caip2";
import { type HotBridgeChain, HotBridgeChains } from "./hot-bridge-chains";

const nativeTokenMapping: Record<HotBridgeChain, string> = {
	[Chains.BNB]: "nep245:v2_1.omni.hot.tg:56_11111111111111111111",
	[Chains.Polygon]: "nep245:v2_1.omni.hot.tg:137_11111111111111111111",
	[Chains.TON]: "nep245:v2_1.omni.hot.tg:1117_",
	[Chains.Optimism]: "nep245:v2_1.omni.hot.tg:10_11111111111111111111",
	[Chains.Avalanche]: "nep245:v2_1.omni.hot.tg:43114_11111111111111111111",
	[Chains.Stellar]:
		"nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz",
};

const caip2NetworkIdMapping: Record<HotBridgeChain, Network> = {
	[Chains.BNB]: Network.Bnb,
	[Chains.Polygon]: Network.Polygon,
	[Chains.TON]: Network.Ton,
	[Chains.Optimism]: Network.Optimism,
	[Chains.Avalanche]: Network.Avalanche,
	[Chains.Stellar]: Network.Stellar,
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
	if (networkIdCAIP2Mapping[network as unknown as Network] != null) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return networkIdCAIP2Mapping[network as unknown as Network]!;
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

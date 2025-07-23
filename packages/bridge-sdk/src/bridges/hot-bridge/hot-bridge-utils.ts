import { Network } from "@hot-labs/omni-sdk";
import { assert } from "../../lib/assert";
import { type CAIP2NetworkValue, CAIP2_NETWORK } from "../../lib/caip2";
import { HOT_BRIDGE_CHAINS_CAIP2 } from "./hot-bridge-constants";
import type { HotBridgeChainsCAIP2 } from "./hot-bridge-types";

export function getFeeAssetIdForChain(caip2: HotBridgeChainsCAIP2) {
	switch (caip2) {
		case CAIP2_NETWORK.BNB:
			return "nep245:v2_1.omni.hot.tg:56_11111111111111111111";
		case CAIP2_NETWORK.Polygon:
			return "nep245:v2_1.omni.hot.tg:137_11111111111111111111";
		case CAIP2_NETWORK.TON:
			return "nep245:v2_1.omni.hot.tg:1117_";
		case CAIP2_NETWORK.Optimism:
			return "nep245:v2_1.omni.hot.tg:10_11111111111111111111";
		case CAIP2_NETWORK.Avalanche:
			return "nep245:v2_1.omni.hot.tg:43114_11111111111111111111";
		case CAIP2_NETWORK.Stellar:
			return "nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz";
		default:
			caip2 satisfies never;
			throw new Error(`Unsupported chain = ${caip2}`);
	}
}

export function toHOTNetwork(caip2: CAIP2NetworkValue): Network {
	const mapping: Record<HotBridgeChainsCAIP2, Network> = {
		[CAIP2_NETWORK.BNB]: Network.Bnb,
		[CAIP2_NETWORK.Polygon]: Network.Polygon,
		[CAIP2_NETWORK.TON]: Network.Ton,
		[CAIP2_NETWORK.Optimism]: Network.Optimism,
		[CAIP2_NETWORK.Avalanche]: Network.Avalanche,
		[CAIP2_NETWORK.Stellar]: Network.Stellar,
	};

	if (caip2 in mapping) {
		return mapping[caip2 as keyof typeof mapping];
	}

	throw new Error(`Unsupported HOT Bridge chain = ${caip2}`);
}

export function networkIdToCaip2(network: string): CAIP2NetworkValue {
	const mapping: Record<string, CAIP2NetworkValue> = {
		[Network.Bnb]: CAIP2_NETWORK.BNB,
		[Network.Polygon]: CAIP2_NETWORK.Polygon,
		[Network.Ton]: CAIP2_NETWORK.TON,
		[Network.Optimism]: CAIP2_NETWORK.Optimism,
		[Network.Avalanche]: CAIP2_NETWORK.Avalanche,
		[Network.Stellar]: CAIP2_NETWORK.Stellar,
	};

	if (mapping[network] != null) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return mapping[network]!;
	}

	throw new Error(`Unsupported HOT Bridge network = ${network}`);
}

/**
 * HOT returns hexified raw bytes. So we need to return more friendly/common string.
 */
export function formatTxHash(txHash: string, caip2: CAIP2NetworkValue) {
	if (caip2.startsWith("eip155:")) {
		return `0x${txHash}`;
	}
	return txHash;
}

export function hotBlockchainInvariant(
	blockchain: string,
): asserts blockchain is HotBridgeChainsCAIP2 {
	assert(
		(HOT_BRIDGE_CHAINS_CAIP2 as string[]).includes(blockchain),
		`${blockchain} is not a valid HOT Bridge blockchain. Supported values: ${HOT_BRIDGE_CHAINS_CAIP2.join()}`,
	);
}

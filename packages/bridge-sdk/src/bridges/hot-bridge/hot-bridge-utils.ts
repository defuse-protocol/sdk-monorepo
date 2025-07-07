import { Network } from "@hot-labs/omni-sdk";
import { assert } from "../../lib/assert";
import { CAIP2_NETWORK } from "../../lib/caip2";
import { HOT_BRIDGE_CHAINS_CAIP2 } from "./hot-bridge-constants";

export function getFeeAssetIdForChain(caip2: HOT_BRIDGE_CHAINS_CAIP2) {
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
		default:
			caip2 satisfies never;
			throw new Error(`Unsupported chain = ${caip2}`);
	}
}

export function toHOTNetwork(caip2: CAIP2_NETWORK): Network {
	const mapping: Record<HOT_BRIDGE_CHAINS_CAIP2, Network> = {
		[CAIP2_NETWORK.BNB]: Network.Bnb,
		[CAIP2_NETWORK.Polygon]: Network.Polygon,
		[CAIP2_NETWORK.TON]: Network.Ton,
		[CAIP2_NETWORK.Optimism]: Network.Optimism,
		[CAIP2_NETWORK.Avalanche]: Network.Avalanche,
	};

	if (caip2 in mapping) {
		return mapping[caip2 as keyof typeof mapping];
	}

	throw new Error(`Unsupported HOT Bridge chain = ${caip2}`);
}

export function networkIdToCaip2(network: string): CAIP2_NETWORK {
	const mapping: Record<string, CAIP2_NETWORK> = {
		[Network.Bnb]: CAIP2_NETWORK.BNB,
		[Network.Polygon]: CAIP2_NETWORK.Polygon,
		[Network.Ton]: CAIP2_NETWORK.TON,
		[Network.Optimism]: CAIP2_NETWORK.Optimism,
		[Network.Avalanche]: CAIP2_NETWORK.Avalanche,
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
export function formatTxHash(txHash: string, caip2: CAIP2_NETWORK) {
	if (caip2.startsWith("eip155:")) {
		return `0x${txHash}`;
	}
	return txHash;
}

export function hotBlockchainInvariant(
	blockchain: string,
): asserts blockchain is HOT_BRIDGE_CHAINS_CAIP2 {
	assert(
		(HOT_BRIDGE_CHAINS_CAIP2 as string[]).includes(blockchain),
		`${blockchain} is not a valid HOT Bridge blockchain. Supported values: ${HOT_BRIDGE_CHAINS_CAIP2.join()}`,
	);
}

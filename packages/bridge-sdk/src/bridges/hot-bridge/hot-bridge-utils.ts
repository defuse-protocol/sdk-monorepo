import { Network } from "@hot-labs/omni-sdk";
import { CAIP2_NETWORK } from "../../lib/caip2";

export function getFeeAssetIdForChain(caip2: CAIP2_NETWORK) {
	switch (caip2) {
		case CAIP2_NETWORK.BNB:
			return "nep245:v2_1.omni.hot.tg:56_11111111111111111111";
		case CAIP2_NETWORK.Polygon:
			return "nep245:v2_1.omni.hot.tg:137_11111111111111111111";
		case CAIP2_NETWORK.TON:
			return "nep245:v2_1.omni.hot.tg:1117_";
		default:
			throw new Error(`Unsupported chain = ${caip2}`);
	}
}

export function toHOTNetwork(caip2: CAIP2_NETWORK): Network {
	const mapping: Record<string, Network> = {
		[CAIP2_NETWORK.BNB]: Network.Bnb,
		[CAIP2_NETWORK.Polygon]: Network.Polygon,
		[CAIP2_NETWORK.TON]: Network.Ton,
	};

	if (mapping[caip2] == null) {
		throw new Error(`Unsupported HOT Bridge chain = ${caip2}`);
	}
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return mapping[caip2]!;
}

export function networkIdToCaip2(network: string): CAIP2_NETWORK {
	const mapping: Record<string, CAIP2_NETWORK> = {
		[Network.Bnb]: CAIP2_NETWORK.BNB,
		[Network.Polygon]: CAIP2_NETWORK.Polygon,
		[Network.Ton]: CAIP2_NETWORK.TON,
	};

	if (mapping[network] != null) {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return mapping[network]!;
	}

	throw new Error(`Unsupported HOT Bridge network = ${network}`);
}

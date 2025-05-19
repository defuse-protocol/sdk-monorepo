import { Network } from "@hot-labs/omni-sdk";
import { CAIP2_NETWORK } from "../../lib/caip2.ts";

export function getFeeAssetIdForChain(caip2: CAIP2_NETWORK) {
	switch (caip2) {
		case CAIP2_NETWORK.BNB:
			return "nep245:v2_1.omni.hot.tg:56_11111111111111111111";
		case CAIP2_NETWORK.Polygon:
			return "nep245:v2_1.omni.hot.tg:137_11111111111111111111";
		default:
			throw new Error(`Unsupported chain = ${caip2}`);
	}
}

export function toHOTNetwork(caip2: CAIP2_NETWORK): Network {
	const mapping = {
		[CAIP2_NETWORK.BNB]: Network.Bnb,
		[CAIP2_NETWORK.Polygon]: Network.Polygon,
	};

	if (mapping[caip2] == null) {
		throw new Error(`Unsupported HOT Bridge chain = ${caip2}`);
	}
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return mapping[caip2]!;
}

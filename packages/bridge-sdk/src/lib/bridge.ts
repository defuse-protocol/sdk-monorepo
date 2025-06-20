import type {
	BridgeConfig,
	IBridgeSDK,
	WithdrawalParams,
} from "../shared-types";
import { assert } from "./assert";

export function determineBridge(
	sdk: IBridgeSDK,
	withdrawalParams: WithdrawalParams,
): BridgeConfig {
	if (withdrawalParams.bridgeConfig) {
		return withdrawalParams.bridgeConfig;
	}

	const parseAssetId = sdk.parseAssetId(withdrawalParams.assetId);
	assert(
		parseAssetId.bridge !== "aurora_engine",
		"aurora_engine should be passed as `bridgeConfig`",
	);
	return {
		bridge: parseAssetId.bridge,
		chain: parseAssetId.blockchain,
	};
}

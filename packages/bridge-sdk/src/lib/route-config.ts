import { RouteEnum } from "../constants/route-enum";
import type {
	IBridgeSDK,
	RouteConfig,
	WithdrawalParams,
} from "../shared-types";
import { assert } from "./assert";

export function determineRouteConfig(
	sdk: IBridgeSDK,
	withdrawalParams: WithdrawalParams,
): RouteConfig {
	if (withdrawalParams.routeConfig != null) {
		return withdrawalParams.routeConfig;
	}

	const parseAssetId = sdk.parseAssetId(withdrawalParams.assetId);
	assert(
		parseAssetId.route !== RouteEnum.VirtualChain,
		`${RouteEnum.VirtualChain} should be passed as \`routeConfig\``,
	);
	return {
		route: parseAssetId.route,
		chain: parseAssetId.blockchain,
	};
}

import { BridgeNameEnum } from "../constants/bridge-name-enum";
import { RouteEnum } from "../constants/route-enum";
import type {
	IBridgeSDK,
	RouteConfig,
	WithdrawalParams,
} from "../shared-types";
import { createNearWithdrawalRoute } from "./route-config-factory";

export function determineRouteConfig(
	sdk: IBridgeSDK,
	withdrawalParams: WithdrawalParams,
): RouteConfig {
	if (withdrawalParams.routeConfig != null) {
		return withdrawalParams.routeConfig;
	}

	const parseAssetId = sdk.parseAssetId(withdrawalParams.assetId);

	const bridgeName = parseAssetId.bridgeName;
	switch (bridgeName) {
		case BridgeNameEnum.Hot:
			return {
				route: RouteEnum.HotBridge,
				chain: parseAssetId.blockchain,
			};
		case BridgeNameEnum.Poa:
			return {
				route: RouteEnum.PoaBridge,
				chain: parseAssetId.blockchain,
			};
		case BridgeNameEnum.None:
			return createNearWithdrawalRoute();
		default:
			bridgeName satisfies never;
			throw new Error(`Unexpected bridge = ${bridgeName}`);
	}
}

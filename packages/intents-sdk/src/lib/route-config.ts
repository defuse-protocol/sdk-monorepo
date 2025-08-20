import { BridgeNameEnum } from "../constants/bridge-name-enum";
import type {
	IIntentsSDK,
	RouteConfig,
	WithdrawalParams,
} from "../shared-types";
import {
	createHotBridgeRoute,
	createNearWithdrawalRoute,
	createOmniWithdrawalRoute,
	createPoaBridgeRoute,
} from "./route-config-factory";

export function determineRouteConfig(
	sdk: IIntentsSDK,
	withdrawalParams: WithdrawalParams,
): RouteConfig {
	if (withdrawalParams.routeConfig != null) {
		return withdrawalParams.routeConfig;
	}

	const parseAssetId = sdk.parseAssetId(withdrawalParams.assetId);

	const bridgeName = parseAssetId.bridgeName;
	switch (bridgeName) {
		case BridgeNameEnum.Hot:
			return createHotBridgeRoute(parseAssetId.blockchain);
		case BridgeNameEnum.Poa:
			return createPoaBridgeRoute(parseAssetId.blockchain);
		case BridgeNameEnum.Omni:
			return createOmniWithdrawalRoute();
		case BridgeNameEnum.None:
			return createNearWithdrawalRoute();
		default:
			bridgeName satisfies never;
			throw new Error(`Unexpected bridge = ${bridgeName}`);
	}
}

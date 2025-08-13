import { RouteEnum } from "../constants/route-enum";
import type {
	HotBridgeRouteConfig,
	InternalTransferRouteConfig,
	NearWithdrawalRouteConfig,
	OmniBridgeRouteConfig,
	PoaBridgeRouteConfig,
	VirtualChainRouteConfig,
} from "../shared-types";
import type { Chain } from "./caip2";

export function createInternalTransferRoute(): InternalTransferRouteConfig {
	return { route: RouteEnum.InternalTransfer };
}

export function createNearWithdrawalRoute(
	msg?: string,
): NearWithdrawalRouteConfig {
	return { route: RouteEnum.NearWithdrawal, msg };
}
export function createOmniWithdrawalRoute(): OmniBridgeRouteConfig {
	return { route: RouteEnum.OmniBridge };
}

export function createVirtualChainRoute(
	auroraEngineContractId: string,
	proxyTokenContractId: string | null,
): VirtualChainRouteConfig {
	return {
		route: RouteEnum.VirtualChain,
		auroraEngineContractId,
		proxyTokenContractId,
	};
}

export function createPoaBridgeRoute(chain: Chain): PoaBridgeRouteConfig {
	return {
		route: RouteEnum.PoaBridge,
		chain,
	};
}

export function createHotBridgeRoute(chain: Chain): HotBridgeRouteConfig {
	return {
		route: RouteEnum.HotBridge,
		chain,
	};
}

export function createDefaultRoute(): undefined {}

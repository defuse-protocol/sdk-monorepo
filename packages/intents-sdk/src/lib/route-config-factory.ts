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

/*
 * @param chain - pass chain parameter to withdraw to a specific chain. Without this parameter the token will be withdrawn to its origin chain
 * @returns
 */
export function createOmniBridgeRoute(chain?: Chain): OmniBridgeRouteConfig {
	const routeConfig: OmniBridgeRouteConfig = { route: RouteEnum.OmniBridge };
	if (chain) routeConfig.chain = chain;
	return routeConfig;
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

export function createPoaBridgeRoute(): PoaBridgeRouteConfig {
	return {
		route: RouteEnum.PoaBridge,
	};
}

export function createHotBridgeRoute(chain: Chain): HotBridgeRouteConfig {
	return {
		route: RouteEnum.HotBridge,
		chain,
	};
}

export function createDefaultRoute(): undefined {}

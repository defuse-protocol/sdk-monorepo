import { RouteEnum } from "../constants/route-enum";
import type {
	InternalTransferRouteConfig,
	NearWithdrawalRouteConfig,
	VirtualChainRouteConfig,
} from "../shared-types";

export function createInternalTransferRoute(): InternalTransferRouteConfig {
	return { route: RouteEnum.InternalTransfer };
}

export function createNearWithdrawalRoute(
	msg?: string,
): NearWithdrawalRouteConfig {
	return { route: RouteEnum.NearWithdrawal, msg };
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

export function createDefaultRoute(): undefined {}

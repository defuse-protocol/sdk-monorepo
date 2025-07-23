export const RouteEnum = {
	HotBridge: "hot_bridge",
	PoaBridge: "poa_bridge",
	NearWithdrawal: "near_withdrawal",
	VirtualChain: "virtual_chain",
	InternalTransfer: "internal_transfer",
} as const;

export type RouteEnumType = typeof RouteEnum;
export type RouteEnumValue = (typeof RouteEnum)[keyof typeof RouteEnum];

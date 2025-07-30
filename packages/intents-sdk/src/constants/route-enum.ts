export const RouteEnum = {
	HotBridge: "hot_bridge",
	PoaBridge: "poa_bridge",
	OmniBridge: "omni_bridge",
	NearWithdrawal: "near_withdrawal",
	VirtualChain: "virtual_chain",
	InternalTransfer: "internal_transfer",
} as const;

export type RouteEnum = typeof RouteEnum;

export type RouteEnumValues = (typeof RouteEnum)[keyof typeof RouteEnum];

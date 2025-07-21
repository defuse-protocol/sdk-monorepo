export const RouteEnum = {
	HotBridge: "hot",
	PoaBridge: "poa",
	NearWithdrawal: "direct",
	VirtualChain: "aurora_engine",
	InternalTransfer: "intents",
} as const;

export type RouteEnum = typeof RouteEnum;

export type RouteEnumValues = (typeof RouteEnum)[keyof typeof RouteEnum];

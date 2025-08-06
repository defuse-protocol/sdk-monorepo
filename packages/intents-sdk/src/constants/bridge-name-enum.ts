export const BridgeNameEnum = {
	Hot: "hot",
	Poa: "poa",
	None: null,
} as const;

export type BridgeNameEnum = typeof BridgeNameEnum;

export type BridgeNameEnumValues =
	(typeof BridgeNameEnum)[keyof typeof BridgeNameEnum];

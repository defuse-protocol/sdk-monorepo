export const BridgeNameEnum = {
	Hot: "hot",
	Poa: "poa",
	None: null,
} as const;

type BridgeNameEnumType = typeof BridgeNameEnum;
export type BridgeNameEnumValue = BridgeNameEnumType[keyof BridgeNameEnumType];

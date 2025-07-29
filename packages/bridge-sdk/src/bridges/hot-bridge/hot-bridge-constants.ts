import { Chains } from "../../lib/caip2";

export const HotWithdrawStatus = {
	Completed: "COMPLETED",
	Canceled: "CANCELED",
} as const;

export const HotBridgeChains = [
	Chains.Polygon,
	Chains.BNB,
	Chains.TON,
	Chains.Optimism,
	Chains.Avalanche,
	Chains.Stellar,
] as const;

export type HotBridgeChain = (typeof HotBridgeChains)[number];

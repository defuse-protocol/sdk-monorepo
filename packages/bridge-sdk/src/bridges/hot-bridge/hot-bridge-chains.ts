import { Chains } from "../../lib/caip2";

export type HotBridgeChain = (typeof HotBridgeChains)[number];
export type HotBridgeEVMChain = Extract<HotBridgeChain, `eip155:${string}`>;

export const HotBridgeChains = [
	Chains.Polygon,
	Chains.BNB,
	Chains.TON,
	Chains.Optimism,
	Chains.Avalanche,
	Chains.Stellar,
];

export const HotBridgeEVMChains = HotBridgeChains.filter<
	Extract<HotBridgeChain, `eip155:${string}`>
>((a): a is HotBridgeEVMChain => a.startsWith("eip155:"));

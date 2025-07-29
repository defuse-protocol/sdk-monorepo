import type { HotBridgeChain } from "./hot-bridge-constants";

export type HotBridgeEVMChainIds = Extract<
	HotBridgeChain,
	`eip155:${string}`
> extends `eip155:${infer T}`
	? T extends `${infer N extends number}`
		? N
		: never
	: never;

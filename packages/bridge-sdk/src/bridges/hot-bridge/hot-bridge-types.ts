import type { HOT_BRIDGE_CHAINS_CAIP2 } from "./hot-bridge-constants";

export type HotBridgeEVMChainIds = Extract<
	HOT_BRIDGE_CHAINS_CAIP2,
	`eip155:${string}`
> extends `eip155:${infer T}`
	? T extends `${infer N extends number}`
		? N
		: never
	: never;

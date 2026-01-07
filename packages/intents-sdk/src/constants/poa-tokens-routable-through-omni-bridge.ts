import { ChainKind } from "omni-bridge-sdk";

/**
 * These tokens can be routed through either PoA Bridge or Omni Bridge
 * depending on the SDK configuration. Use the `routeMigratedPoaTokensThroughOmniBridge`
 * feature flag to enable Omni Bridge routing for these tokens.
 */
export const POA_TOKENS_ROUTABLE_THROUGH_OMNI_BRIDGE: Record<
	string,
	ChainKind
> = {
	"sol-57d087fd8c460f612f8701f5499ad8b2eec5ab68.omft.near": ChainKind.Sol, // BOOK OF MEME,
	"sol-c58e6539c2f2e097c251f8edf11f9c03e581f8d4.omft.near": ChainKind.Sol, // OFFICIAL TRUMP
	"sol-b9c68f94ec8fd160137af8cdfe5e61cd68e2afba.omft.near": ChainKind.Sol, // WIF
} as const;

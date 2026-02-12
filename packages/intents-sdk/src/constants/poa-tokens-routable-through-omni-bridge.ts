import { ChainKind } from "@omni-bridge/core";

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
	"sol-bb27241c87aa401cc963c360c175dd7ca7035873.omft.near": ChainKind.Sol, // LOUD
	"sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near": ChainKind.Sol, // USDT
	"sol-91914f13d3b54f8126a2824d71632d4b078d7403.omft.near": ChainKind.Sol, // xBTC
	"sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near": ChainKind.Sol, // USDC
	"sol-df27d7abcc1c656d4ac3b1399bbfbba1994e6d8c.omft.near": ChainKind.Sol, // TURBO
	"sol-1f00bb36e75cfc8e1274c1507cc3054f5b3f3ce1.omft.near": ChainKind.Sol, // PUBLIC
	"sol-c634d063ceff771aff0c972ec396fd915a6bbd0e.omft.near": ChainKind.Sol, // SPX
	"sol-2dc7b64e5dd3c717fc85abaf51cdcd4b18687f09.omft.near": ChainKind.Sol, // sUSDC
	"sol-d600e625449a4d9380eaf5e3265e54c90d34e260.omft.near": ChainKind.Sol, // MELANIA
	"sol.omft.near": ChainKind.Sol, // SOL
} as const;

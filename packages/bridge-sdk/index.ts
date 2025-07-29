export type { BridgeSDKConfig, BridgeSDK } from "./src/sdk";

export {
	createIntentSignerNearKeyPair,
	createIntentSignerNEP413,
	createIntentSignerViem,
} from "./src/intents/intent-signer-impl";

export type {
	FeeEstimation,
	WithdrawalParams,
	RouteConfig,
} from "./src/shared-types";

export {
	FeeExceedsAmountError,
	type FeeExceedsAmountErrorType,
	MinWithdrawalAmountError,
	type MinWithdrawalAmountErrorType,
	TrustlineNotFoundError,
	type TrustlineNotFoundErrorType,
	UnsupportedDestinationMemoError,
	type UnsupportedDestinationMemoErrorType,
} from "./src/classes/errors";

export {
	Chains,
	type Chain,
} from "./src/lib/caip2";

export {
	createDefaultRoute,
	createHotBridgeRoute,
	createInternalTransferRoute,
	createNearWithdrawalRoute,
	createPoaBridgeRoute,
	createVirtualChainRoute,
} from "./src/lib/route-config-factory";

export {
	BridgeNameEnum,
	type BridgeNameEnumValues,
} from "./src/constants/bridge-name-enum";

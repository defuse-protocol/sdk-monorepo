// ============================================================================
// Core SDK
// ============================================================================
export { BridgeSDK, type BridgeSDKConfig } from "./src/sdk";

// ============================================================================
// Intent Signers
// ============================================================================
export {
	createIntentSignerNearKeyPair,
	createIntentSignerNEP413,
	createIntentSignerViem,
} from "./src/intents/intent-signer-impl";

export type { IIntentSigner } from "./src/intents/interfaces/intent-signer";

// ============================================================================
// Core Types
// ============================================================================
export type {
	// Main withdrawal interfaces
	WithdrawalParams,
	FeeEstimation,
	WithdrawalIdentifier,
	// Route configurations
	RouteConfig,
	NearWithdrawalRouteConfig,
	InternalTransferRouteConfig,
	VirtualChainRouteConfig,
	PoaBridgeRouteConfig,
	HotBridgeRouteConfig,
	// Transaction types
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	// Asset parsing
	ParsedAssetInfo,
} from "./src/shared-types";

// ============================================================================
// Route Factories
// ============================================================================
export {
	createDefaultRoute,
	createInternalTransferRoute,
	createNearWithdrawalRoute,
	createVirtualChainRoute,
	createPoaBridgeRoute,
	createHotBridgeRoute,
} from "./src/lib/route-config-factory";

// ============================================================================
// Constants & Enums
// ============================================================================
export {
	Chains,
	type Chain,
} from "./src/lib/caip2";

export {
	RouteEnum,
	type RouteEnumValues,
} from "./src/constants/route-enum";

export {
	BridgeNameEnum,
	type BridgeNameEnumValues,
} from "./src/constants/bridge-name-enum";

// ============================================================================
// Errors
// ============================================================================
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

// HOT Bridge specific errors
export {
	HotWithdrawalPendingError,
	type HotWithdrawalPendingErrorType,
	HotWithdrawalNotFoundError,
	type HotWithdrawalNotFoundErrorType,
	HotWithdrawalCancelledError,
	type HotWithdrawalCancelledErrorType,
} from "./src/bridges/hot-bridge/error";

// ============================================================================
// Re-exports from internal-utils (commonly needed utilities)
// ============================================================================
export type {
	ILogger,
	RetryOptions,
	NearIntentsEnv,
} from "@defuse-protocol/internal-utils";

export { BaseError } from "@defuse-protocol/internal-utils";

// ============================================================================
// Intent Types (for advanced users)
// ============================================================================
export type {
	IntentPrimitive,
	IntentPayload,
	IntentPayloadFactory,
	IntentRelayParamsFactory,
	MultiPayload,
} from "./src/intents/shared-types";

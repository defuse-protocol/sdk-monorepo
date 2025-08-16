// ============================================================================
// Core SDK
// ============================================================================
export { IntentsSDK, type IntentsSDKConfig } from "./src/sdk";

// ============================================================================
// Intent Signers
// ============================================================================
export {
	createIntentSignerNearKeyPair,
	createIntentSignerNEP413,
	createIntentSignerViem,
} from "./src/intents/intent-signer-impl/factories";

export type { IIntentSigner } from "./src/intents/interfaces/intent-signer";

// ============================================================================
// Core Types
// ============================================================================
export type {
	// Intent-specific
	IntentPublishResult,
	IntentSettlementStatus,
	// Main withdrawal interfaces
	WithdrawalParams,
	FeeEstimation,
	WithdrawalIdentifier,
	ProcessWithdrawalArgs,
	SignAndSendWithdrawalArgs,
	// Route configurations
	RouteConfig,
	NearWithdrawalRouteConfig,
	InternalTransferRouteConfig,
	VirtualChainRouteConfig,
	PoaBridgeRouteConfig,
	HotBridgeRouteConfig,
	OmniBridgeRouteConfig,
	// Results of orchestrated fns
	WithdrawalResult,
	BatchWithdrawalResult,
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
	createOmniWithdrawalRoute,
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

// Base Error Classes
export {
	BaseError,
	type BaseErrorType,
} from "@defuse-protocol/internal-utils";

// Bridge SDK Core Errors
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

// Hot Bridge Errors
export {
	HotWithdrawalPendingError,
	type HotWithdrawalPendingErrorType,
	HotWithdrawalNotFoundError,
	type HotWithdrawalNotFoundErrorType,
	HotWithdrawalCancelledError,
	type HotWithdrawalCancelledErrorType,
} from "./src/bridges/hot-bridge/error";

// Omni Bridge Errors
export {
	OmniTransferNotFoundError,
	type OmniTransferNotFoundErrorType,
	OmniTransferDestinationChainHashNotFoundError,
	type OmniTransferDestinationChainHashNotFoundErrorType,
} from "./src/bridges/omni-bridge/error";

// Poa Bridge Errors
export {
	PoaWithdrawalInvariantError,
	type PoaWithdrawalInvariantErrorType,
	PoaWithdrawalNotFoundError,
	type PoaWithdrawalNotFoundErrorType,
	PoaWithdrawalPendingError,
	type PoaWithdrawalPendingErrorType,
} from "@defuse-protocol/internal-utils";

// HTTP & Network Errors
export {
	HttpRequestError,
	type HttpRequestErrorType,
	RpcRequestError,
	type RpcRequestErrorType,
	TimeoutError,
	type TimeoutErrorType,
} from "@defuse-protocol/internal-utils";

// Assertion Errors
export {
	AssertionError,
	type AssertionErrorType,
} from "@defuse-protocol/internal-utils";

// Solver Relay Errors
export {
	QuoteError,
	type QuoteErrorType,
	IntentSettlementError,
	type IntentSettlementErrorType,
	RelayPublishError,
	type RelayPublishErrorType,
} from "@defuse-protocol/internal-utils";

export type {
	ILogger,
	RetryOptions,
	NearIntentsEnv,
} from "@defuse-protocol/internal-utils";

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

// ============================================================================
// Hooks
// ============================================================================
export type { OnBeforePublishIntentHook } from "./src/intents/intent-executer-impl/intent-executer";

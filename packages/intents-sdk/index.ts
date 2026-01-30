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
	SignedIntentsComposition,
	// Main withdrawal interfaces
	WithdrawalParams,
	FeeEstimation,
	WithdrawalIdentifier,
	ProcessWithdrawalArgs,
	SignAndSendWithdrawalArgs,
	SignAndSendArgs,
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
	createOmniBridgeRoute,
} from "./src/lib/route-config-factory";

// ============================================================================
// Constants & Enums
// ============================================================================
export { Chains, type Chain } from "./src/lib/caip2";

export { RouteEnum, type RouteEnumValues } from "./src/constants/route-enum";

export {
	BridgeNameEnum,
	type BridgeNameEnumValues,
} from "./src/constants/bridge-name-enum";

export { POA_TOKENS_ROUTABLE_THROUGH_OMNI_BRIDGE } from "./src/constants/poa-tokens-routable-through-omni-bridge";
// ============================================================================
// Errors
// ============================================================================

// Base Error Classes
export { BaseError, type BaseErrorType } from "@defuse-protocol/internal-utils";

// Withdrawal Watcher Errors
export {
	WithdrawalWatchError,
	type WithdrawalWatchErrorType,
	WithdrawalFailedError,
	type WithdrawalFailedErrorType,
} from "./src/core/withdrawal-watcher";

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
	UnsupportedAssetIdError,
	type UnsupportedAssetIdErrorType,
} from "./src/classes/errors";

// Direct Bridge Errors
export {
	DestinationExplicitNearAccountDoesntExistError,
	type DestinationExplicitNearAccountDoesntExistErrorType,
} from "./src/bridges/direct-bridge/error";

// Hot Bridge Errors
export {
	HotWithdrawalNotFoundError,
	type HotWithdrawalNotFoundErrorType,
	HotWithdrawalApiFeeRequestTimeoutError,
	type HotWithdrawalApiFeeRequestTimeoutErrorType,
} from "./src/bridges/hot-bridge/error";

// Omni Bridge Errors
export {
	InvalidFeeValueError,
	type InvalidFeeValueErrorType,
	TokenNotFoundInDestinationChainError,
	type TokenNotFoundInDestinationChainErrorType,
	IntentsNearOmniAvailableBalanceTooLowError,
	type IntentsNearOmniAvailableBalanceTooLowErrorType,
	OmniWithdrawalApiFeeRequestTimeoutError,
	type OmniWithdrawalApiFeeRequestTimeoutErrorType,
	InsufficientUtxoForOmniBridgeWithdrawalError,
	type InsufficientUtxoForOmniBridgeWithdrawalErrorType,
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
	EnvConfig,
	RpcEndpoint,
	RpcEndpointConfig,
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

// ============================================================================
// Nonce helpers
// ============================================================================
export { VersionedNonceBuilder } from "./src/intents/expirable-nonce";

// ============================================================================
// Intent Payload Builder
// ============================================================================
export { IntentPayloadBuilder } from "./src/intents/intent-payload-builder";

// ============================================================================
// Intent Hash
// ============================================================================
export { computeIntentHash } from "./src/intents/intent-hash";

// ============================================================================
// Address Validation Helper
// ============================================================================
export { validateAddress as validateAddressFormat } from "./src/lib/validateAddress";

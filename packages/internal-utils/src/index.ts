export * as poaBridge from "./poaBridge";
export * as solverRelay from "./solverRelay";
export * as utils from "./utils";
export * as errors from "./errors";
export * as messageFactory from "./utils/messageFactory";
export * as authIdentity from "./utils/authIdentity";
export * as prepareBroadcastRequest from "./utils/prepareBroadcastRequest";
export * as appFee from "./utils/appFee";
export * as walletMessage from "./types/walletMessage";
export * as authHandle from "./types/authHandle";
export * from "./services/blockchainBalanceService";
export {
	configureSDK,
	config,
	configsByEnvironment,
	type NearIntentsEnv,
} from "./config";
export { type RetryOptions, RETRY_CONFIGS } from "./utils/retry";
export type { ILogger } from "./logger";
export { BlockchainEnum } from "./poaBridge/constants/blockchains";
export { withTimeout } from "./utils/promise/withTimeout";
export { request, type RequestErrorType } from "./utils/request";
export { serialize } from "./utils/serialize";
export { nearFailoverRpcProvider } from "./utils/failover";
export { PUBLIC_NEAR_RPC_URLS } from "./nearClient";
export { AuthMethod } from "./types/authHandle";

// Base error classes
export {
	BaseError,
	type BaseErrorType,
} from "./errors/base";

// Core error classes
export {
	AssertionError,
	type AssertionErrorType,
} from "./errors/assert";

export {
	HttpRequestError,
	type HttpRequestErrorType,
	RpcRequestError,
	type RpcRequestErrorType,
	TimeoutError,
	type TimeoutErrorType,
} from "./errors/request";

// POA Bridge errors
export {
	PoaWithdrawalInvariantError,
	type PoaWithdrawalInvariantErrorType,
	PoaWithdrawalNotFoundError,
	type PoaWithdrawalNotFoundErrorType,
	PoaWithdrawalPendingError,
	type PoaWithdrawalPendingErrorType,
} from "./poaBridge/errors/withdrawal";

// Solver Relay errors
export {
	QuoteError,
	type QuoteErrorType,
} from "./solverRelay/errors/quote";

export {
	IntentSettlementError,
	type IntentSettlementErrorType,
} from "./solverRelay/errors/intentSettlement";

export {
	RelayPublishError,
	type RelayPublishErrorType,
} from "./solverRelay/utils/parseFailedPublishError";

// Top-level utils
export { assert } from "./utils/assert";

// Client
export {
	SolverRelayClient,
	type SolverRelayClientOptions,
	type SolverRelayClientEvents,
} from "./src/client.js";

// Errors
export {
	SolverRelayError,
	type SolverRelayErrorInstance,
	RelayRpcError,
	RequestTimeoutError,
	ConnectionError,
	ValidationError,
	UnexpectedError,
	toSolverRelayError,
} from "./src/errors/index.js";

// Result types (consumers import ok/err/etc from neverthrow directly)
export type { Result, ResultAsync } from "neverthrow";

// Types (public API - snake_case matching protocol)
export type {
	Metadata,
	Quote,
	QuoteArgs,
	QuoteError,
	QuoteExecution,
	QuoteFilters,
	QuoteOutput,
	QuoteRequest,
	QuoteResponse,
	QuoteResponseResult,
	QuoteResults,
} from "./src/types/index.js";

export {
	QuoteOutputType,
	QuoteOutputFactory,
	QuoteExecutionEventType,
} from "./src/types/index.js";

// Protocol types
export type {
	JsonRpcError,
	JsonRpcRequest,
	JsonRpcResponse,
	JsonRpcNotification,
} from "./src/protocol/types.js";

// Telemetry types (also available via /telemetry subpath)
export type {
	TelemetryHooks,
	SpanLike,
	TraceContext,
} from "./src/telemetry/types.js";

// Schemas (for advanced users who need runtime validation)
export {
	QuoteRequestSchema,
	QuoteExecutionSchema,
	MetadataSchema,
	QuoteSchema,
	QuoteErrorSchema,
	EventParamsSchema,
} from "./src/schemas/index.js";

// Protocol schemas
export {
	JsonRpcResponseSchema,
	JsonRpcNotificationSchema,
} from "./src/protocol/schemas.js";

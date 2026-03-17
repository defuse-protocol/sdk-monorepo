import { EventEmitter } from "node:events";
import { ResultAsync } from "neverthrow";
import * as v from "valibot";
import {
	type SolverRelayErrorInstance,
	RelayRpcError,
	toSolverRelayError,
} from "./errors/index.js";
import { JsonRpcProtocol } from "./protocol/jsonrpc-protocol.js";
import {
	EventParamsSchema,
	QuoteErrorSchema,
	QuoteExecutionSchema,
	QuoteRequestSchema,
	QuoteSchema,
} from "./schemas/index.js";
import type { TelemetryHooks } from "./telemetry/types.js";
import { WebSocketTransport } from "./transport/websocket-transport.js";
import type {
	Metadata,
	Quote,
	QuoteArgs,
	QuoteError,
	QuoteExecution,
	QuoteFilters,
	QuoteOutputType,
	QuoteRequest,
	QuoteResponse,
	QuoteResponseResult,
	QuoteResults,
} from "./types/wire.js";

/**
 * Client event signatures
 */
export interface SolverRelayClientEvents {
	connected: [];
	disconnected: [error?: Error];
	reconnecting: [attempt: number];
	quote: [request: QuoteRequest, metadata: Metadata];
	quoteStatus: [execution: QuoteExecution];
	streamEvent: [streamName: string, data: unknown, metadata: Metadata];
	error: [error: Error];
}

/**
 * Client configuration options
 */
export interface SolverRelayClientOptions {
	/** WebSocket URL of the solver relay */
	wsUrl: string;
	/** JWT token for authentication */
	jwt?: string;
	/** Enable automatic reconnection (default: true) */
	autoReconnect?: boolean;
	/** Delay between reconnection attempts in ms (default: 1000) */
	reconnectDelay?: number;
	/** Maximum number of reconnection attempts (default: 5) */
	maxReconnectAttempts?: number;
	/** Timeout for RPC requests in ms (default: 10000) */
	requestTimeout?: number;
	/** Timeout for WebSocket connection in ms (default: 30000) */
	connectTimeout?: number;
	/** Telemetry hooks for trace context propagation */
	telemetry?: TelemetryHooks;
}

/**
 * WebSocket client for connecting to the solver relay.
 *
 * @example
 * ```typescript
 * const client = new SolverRelayClient({
 *   wsUrl: 'ws://localhost:4000/ws',
 *   jwt: process.env.JWT,
 * });
 *
 * client.on('quote', async (request, metadata) => {
 *   const result = await client.sendQuoteResponse({
 *     quote_id: request.quote_id,
 *     quote_output: { amount_out: '1000000' },
 *     signed_data: signedPayload,
 *   });
 *   result.match(
 *     (res) => console.log('Accepted:', res.accepted),
 *     (error) => console.error('Failed:', error.message),
 *   );
 * });
 *
 * await client.connect();
 * await client.subscribeQuotes();
 * ```
 */
export class SolverRelayClient extends EventEmitter<SolverRelayClientEvents> {
	private readonly transport: WebSocketTransport;
	private readonly protocol: JsonRpcProtocol;
	private readonly telemetry?: TelemetryHooks;

	// Subscription management (IDs hidden from public API)
	private quoteSubscriptionId?: string;
	private quoteStatusSubscriptionId?: string;
	private quoteFilters?: QuoteFilters;
	private hadQuoteSubscription = false;
	private hadQuoteStatusSubscription = false;
	private isReconnecting = false;

	constructor(options: SolverRelayClientOptions) {
		super();

		this.transport = new WebSocketTransport({
			wsUrl: options.wsUrl,
			jwt: options.jwt,
			autoReconnect: options.autoReconnect,
			reconnectDelay: options.reconnectDelay,
			maxReconnectAttempts: options.maxReconnectAttempts,
			connectTimeout: options.connectTimeout,
		});

		this.protocol = new JsonRpcProtocol(this.transport, {
			requestTimeout: options.requestTimeout,
		});

		this.telemetry = options.telemetry;

		// Wire up transport events
		this.transport.on("open", () => this.handleTransportOpen());
		this.transport.on("close", (error) => this.emit("disconnected", error));
		this.transport.on("reconnecting", (attempt) => {
			this.isReconnecting = true;
			this.emit("reconnecting", attempt);
		});
		this.transport.on("error", (error) => this.emit("error", error));

		// Wire up protocol events
		this.protocol.on("notification", (method, params) =>
			this.handleNotification(method, params),
		);
		this.protocol.on("error", (error) => this.emit("error", error));
	}

	/**
	 * Connect to the solver relay.
	 * Resolves when connected and authenticated.
	 */
	async connect(): Promise<void> {
		await this.transport.connect();
		// handleTransportOpen will be called via 'open' event
	}

	/**
	 * Disconnect from the solver relay.
	 */
	disconnect(): void {
		this.protocol.reset();
		this.quoteSubscriptionId = undefined;
		this.quoteStatusSubscriptionId = undefined;
		this.transport.disconnect();
	}

	/**
	 * Check if connected to the relay.
	 */
	isConnected(): boolean {
		return this.transport.isConnected();
	}

	/**
	 * Subscribe to quote requests.
	 *
	 * Calling this method multiple times will update the subscription filters
	 * on the server - only one quote subscription per connection is allowed.
	 * The server silently replaces the previous subscription with new filters.
	 *
	 * @param filters Optional filters for quote subscription
	 */
	async subscribeQuotes(filters?: QuoteFilters): Promise<void> {
		this.hadQuoteSubscription = true;
		this.quoteFilters = filters;

		const params: unknown[] = ["quote"];
		if (filters) {
			params.push(filters);
		}

		const subscriptionId = await this.protocol.request<string>(
			"subscribe",
			params,
		);
		this.quoteSubscriptionId = subscriptionId;
	}

	/**
	 * Subscribe to quote status updates (execution notifications).
	 *
	 * Only one quote status subscription per connection is allowed.
	 * Calling this method multiple times has no effect on the server.
	 */
	async subscribeQuoteStatus(): Promise<void> {
		this.hadQuoteStatusSubscription = true;

		const subscriptionId = await this.protocol.request<string>("subscribe", [
			"quote_status_extended",
		]);
		this.quoteStatusSubscriptionId = subscriptionId;
	}

	/**
	 * Unsubscribe from quote requests.
	 */
	async unsubscribeQuotes(): Promise<void> {
		if (!this.quoteSubscriptionId) {
			return;
		}

		await this.protocol.request("unsubscribe", [this.quoteSubscriptionId]);
		this.quoteSubscriptionId = undefined;
		this.hadQuoteSubscription = false;
		this.quoteFilters = undefined;
	}

	/**
	 * Unsubscribe from quote status updates.
	 */
	async unsubscribeQuoteStatus(): Promise<void> {
		if (!this.quoteStatusSubscriptionId) {
			return;
		}

		await this.protocol.request("unsubscribe", [
			this.quoteStatusSubscriptionId,
		]);
		this.quoteStatusSubscriptionId = undefined;
		this.hadQuoteStatusSubscription = false;
	}

	/**
	 * Generic subscribe to any stream.
	 *
	 * @param streamName Stream name to subscribe to
	 * @param filters Optional filters for the subscription
	 * @returns Subscription ID
	 */
	async subscribe(streamName: string, filters?: unknown): Promise<string> {
		const params: unknown[] = [streamName];
		if (filters) {
			params.push(filters);
		}
		return this.protocol.request<string>("subscribe", params);
	}

	/**
	 * Generic unsubscribe from any stream.
	 *
	 * @param subscriptionId Subscription ID to unsubscribe
	 */
	async unsubscribe(subscriptionId: string): Promise<void> {
		await this.protocol.request("unsubscribe", [subscriptionId]);
	}

	/**
	 * Generic RPC call.
	 *
	 * Expected error subtypes: RelayRpcError, ConnectionError, RequestTimeoutError.
	 *
	 * @param method RPC method name
	 * @param params Optional parameters
	 * @returns Ok with RPC result, Err with SolverRelayError
	 */
	rpc<T>(
		method: string,
		params?: unknown[],
	): ResultAsync<T, SolverRelayErrorInstance> {
		return ResultAsync.fromPromise(
			this.protocol.request<T>(method, params),
			toSolverRelayError,
		);
	}

	/**
	 * Send a quote response to the relay.
	 * Waits for relay acknowledgment.
	 *
	 * Expected error subtypes: ConnectionError, RequestTimeoutError.
	 * RelayRpcError is caught internally and mapped to `{ accepted: false }`.
	 *
	 * @param response The quote response
	 * @returns Ok with acceptance status, Err with SolverRelayError
	 */
	sendQuoteResponse(
		response: QuoteResponse,
	): ResultAsync<QuoteResponseResult, SolverRelayErrorInstance> {
		return ResultAsync.fromPromise(
			this.sendQuoteResponseInternal(response),
			toSolverRelayError,
		);
	}

	private async sendQuoteResponseInternal(
		response: QuoteResponse,
	): Promise<QuoteResponseResult> {
		try {
			await this.protocol.request("quote_response", [response]);
			return { accepted: true };
		} catch (error) {
			if (error instanceof RelayRpcError) {
				return {
					accepted: false,
					error: {
						code: error.code,
						message: error.message,
					},
				};
			}
			throw error;
		}
	}

	/**
	 * Send a "no liquidity" response for a quote.
	 * Use when unable to provide a quote.
	 *
	 * Expected error subtypes: RelayRpcError, ConnectionError, RequestTimeoutError.
	 *
	 * @param quoteId The quote ID to respond to
	 * @param opts Optional parameters
	 * @returns Ok with void, Err with SolverRelayError
	 */
	sendNoLiquidityResponse(
		quoteId: string,
		opts?: { type?: QuoteOutputType; time_to_liquidity_ms?: number },
	): ResultAsync<void, SolverRelayErrorInstance> {
		return ResultAsync.fromPromise(
			this.protocol.request("quote_response", [
				{
					quote_id: quoteId,
					quote_output: {
						type: opts?.type ?? "NO_LIQUIDITY",
					},
				},
			]),
			toSolverRelayError,
		);
	}

	/**
	 * Request quotes from other solvers (for router solvers).
	 * This is an RPC-style call that waits for the relay to collect quotes.
	 *
	 * Expected error subtypes: RelayRpcError, ConnectionError, RequestTimeoutError.
	 *
	 * @param args Quote request arguments
	 * @returns Ok with quotes and errors from other solvers, Err with SolverRelayError
	 */
	requestQuotes(
		args: QuoteArgs,
	): ResultAsync<QuoteResults, SolverRelayErrorInstance> {
		return ResultAsync.fromPromise(
			this.requestQuotesInternal(args),
			toSolverRelayError,
		);
	}

	private async requestQuotesInternal(args: QuoteArgs): Promise<QuoteResults> {
		const result = await this.protocol.request<unknown[]>("quote", [args]);

		if (!Array.isArray(result)) {
			return { quotes: [], errors: [] };
		}

		const quotes: Quote[] = [];
		const errors: QuoteError[] = [];

		for (const item of result) {
			const quoteResult = v.safeParse(QuoteSchema, item);
			if (quoteResult.success) {
				quotes.push(quoteResult.output);
				continue;
			}

			const errorResult = v.safeParse(QuoteErrorSchema, item);
			if (errorResult.success) {
				errors.push(errorResult.output);
			}
		}

		return { quotes, errors };
	}

	private handleTransportOpen(): void {
		// Reset protocol state on fresh connection
		this.protocol.onTransportReconnected();

		// Clear stale subscription IDs (server won't remember them)
		this.quoteSubscriptionId = undefined;
		this.quoteStatusSubscriptionId = undefined;

		// Restore subscriptions if this is a reconnection
		if (this.isReconnecting) {
			this.isReconnecting = false;
			this.restoreSubscriptions().catch((error) => {
				this.emit(
					"error",
					error instanceof Error ? error : new Error(String(error)),
				);
			});
		}

		this.emit("connected");
	}

	private handleNotification(method: string, params: unknown): void {
		if (method !== "event") {
			return;
		}

		const parseResult = v.safeParse(EventParamsSchema, params);
		if (!parseResult.success) {
			return;
		}

		const { subscription, data, metadata } = parseResult.output;

		const emitEvent = () => {
			if (v.is(QuoteRequestSchema, data)) {
				this.emit("quote", data, metadata ?? {});
			} else if (v.is(QuoteExecutionSchema, data)) {
				this.emit("quoteStatus", data);
			} else {
				// Unknown event type - emit as generic stream event
				this.emit("streamEvent", subscription, data, metadata ?? {});
			}
		};

		// Propagate trace context if telemetry hooks are configured
		const traceparent = metadata?.traceparent;
		if (
			traceparent &&
			this.telemetry?.extractTraceContext &&
			this.telemetry?.withContext
		) {
			const ctx = this.telemetry.extractTraceContext(traceparent);
			this.telemetry.withContext(ctx, emitEvent);
		} else {
			emitEvent();
		}
	}

	private async restoreSubscriptions(): Promise<void> {
		if (this.hadQuoteSubscription) {
			await this.subscribeQuotes(this.quoteFilters);
		}
		if (this.hadQuoteStatusSubscription) {
			await this.subscribeQuoteStatus();
		}
	}
}

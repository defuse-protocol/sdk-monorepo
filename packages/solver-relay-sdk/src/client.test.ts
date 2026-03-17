import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JsonRpcRequest } from "./protocol/types.js";

class MockWebSocket extends EventEmitter {
	static OPEN = 1;
	static CLOSED = 3;
	static CONNECTING = 0;

	readyState = MockWebSocket.CONNECTING;
	sentMessages: string[] = [];

	constructor(_url: string, _options?: unknown) {
		super();
	}

	send(data: string): void {
		this.sentMessages.push(data);
	}

	close(): void {
		this.readyState = MockWebSocket.CLOSED;
		this.emit("close");
	}

	override removeAllListeners(event?: string | symbol): this {
		super.removeAllListeners(event);
		return this;
	}

	simulateOpen(): void {
		this.readyState = MockWebSocket.OPEN;
		this.emit("open");
	}

	simulateClose(): void {
		this.readyState = MockWebSocket.CLOSED;
		this.emit("close");
	}

	simulateMessage(data: unknown): void {
		this.emit("message", Buffer.from(JSON.stringify(data)));
	}

	simulateError(error: Error): void {
		this.emit("error", error);
	}

	// Helper: simulate RPC success response
	simulateRpcResponse(id: number, result: unknown): void {
		this.simulateMessage({ jsonrpc: "2.0", id, result });
	}

	// Helper: simulate RPC error response
	simulateRpcError(id: number, code: number, message: string): void {
		this.simulateMessage({ jsonrpc: "2.0", id, error: { code, message } });
	}

	// Helper: simulate event push (subscription)
	simulateEvent(
		subscription: string,
		data: unknown,
		metadata?: { traceparent?: string; partner_id?: string },
	): void {
		this.simulateMessage({
			jsonrpc: "2.0",
			method: "event",
			params: { subscription, data, metadata },
		});
	}

	// Helper: get last sent message as parsed object
	getLastSentMessage(): JsonRpcRequest | null {
		const lastMessage = this.sentMessages.at(-1);
		if (!lastMessage) return null;
		return JSON.parse(lastMessage);
	}
}

// Store reference to the last created MockWebSocket
let mockWsInstance: MockWebSocket | null = null;

vi.mock("ws", () => {
	return {
		default: class extends MockWebSocket {
			constructor(url: string, options?: unknown) {
				super(url, options);
				mockWsInstance = this;
			}
		},
	};
});

describe("SolverRelayClient", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockWsInstance = null;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	async function createClient(options?: {
		autoReconnect?: boolean;
		maxReconnectAttempts?: number;
	}) {
		const { SolverRelayClient } = await import("./client.js");
		return new SolverRelayClient({
			wsUrl: "ws://localhost:4000/ws",
			autoReconnect: options?.autoReconnect ?? true,
			reconnectDelay: 1000,
			maxReconnectAttempts: options?.maxReconnectAttempts ?? 3,
			requestTimeout: 5000,
		});
	}

	async function connectClient(
		client: Awaited<ReturnType<typeof createClient>>,
	): Promise<MockWebSocket> {
		const connectPromise = client.connect();
		await vi.advanceTimersByTimeAsync(0);
		mockWsInstance?.simulateOpen();
		await connectPromise;
		if (!mockWsInstance) throw new Error("MockWebSocket not created");
		return mockWsInstance;
	}

	describe("connect()", () => {
		it("rejects second concurrent connect with error", async () => {
			const client = await createClient();

			const connectPromise1 = client.connect();
			await vi.advanceTimersByTimeAsync(0);

			const connectPromise2 = client.connect();
			await expect(connectPromise2).rejects.toThrow(
				"Connection already in progress",
			);

			// Complete the first connection to avoid unhandled rejection
			mockWsInstance?.simulateOpen();
			await connectPromise1;
			client.disconnect();
		});

		it("resolves when WebSocket opens", async () => {
			const client = await createClient();
			const connectedHandler = vi.fn();
			client.on("connected", connectedHandler);

			await connectClient(client);

			expect(connectedHandler).toHaveBeenCalled();
			expect(client.isConnected()).toBe(true);
			client.disconnect();
		});
	});

	describe("disconnect()", () => {
		it("emits disconnected event", async () => {
			const client = await createClient();
			const disconnectedHandler = vi.fn();
			client.on("disconnected", disconnectedHandler);

			client.disconnect();

			expect(disconnectedHandler).toHaveBeenCalled();
		});

		it("rejects pending RPC requests", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			expect(ws.sentMessages.length).toBe(1);

			client.disconnect();

			await expect(rpcPromise).rejects.toThrow("Client disconnected");
		});
	});

	describe("connection state", () => {
		it("isConnected returns false initially", async () => {
			const client = await createClient();

			expect(client.isConnected()).toBe(false);
		});

		it("isConnected returns false after disconnect", async () => {
			const client = await createClient();

			client.disconnect();

			expect(client.isConnected()).toBe(false);
		});
	});

	describe("rpc()", () => {
		it("sends JSON-RPC request with correct format", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				jsonrpc: "2.0",
				id: 0,
				method: "subscribe",
				params: ["quote"],
			});

			ws.simulateRpcResponse(0, "sub-123");
			await rpcPromise;
			client.disconnect();
		});

		it("resolves when server sends result", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateRpcResponse(0, "sub-123");

			// subscribeQuotes() now returns void (subscription ID is internal)
			await rpcPromise;
			expect(client.isConnected()).toBe(true);

			client.disconnect();
		});

		it("rejects when server sends error", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateRpcError(0, -32000, "Subscription failed");

			await expect(rpcPromise).rejects.toThrow("Subscription failed");

			client.disconnect();
		});

		it("rejects on timeout", async () => {
			const client = await createClient({ autoReconnect: false });
			await connectClient(client);

			const rpcPromise = client.subscribeQuotes().catch((e) => e);

			await vi.advanceTimersByTimeAsync(5000);

			const error = await rpcPromise;
			expect(error.message).toContain("timed out");

			client.disconnect();
		});

		it("rejects when WebSocket is not connected", async () => {
			const client = await createClient();

			await expect(client.subscribeQuotes()).rejects.toThrow(
				"WebSocket is not connected",
			);
		});
	});

	describe("subscribeQuotes()", () => {
		it("sends subscribe request with quote type", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "subscribe",
				params: ["quote"],
			});

			ws.simulateRpcResponse(0, "sub-123");
			await rpcPromise;
			client.disconnect();
		});

		it("includes filters when provided", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const filters = { chains: ["near"], tokens_in: ["wrap.near"] };
			const rpcPromise = client.subscribeQuotes(filters);
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "subscribe",
				params: ["quote", { chains: ["near"], tokens_in: ["wrap.near"] }],
			});

			ws.simulateRpcResponse(0, "sub-123");
			await rpcPromise;
			client.disconnect();
		});
	});

	describe("subscribeQuoteStatus()", () => {
		it("sends subscribe request with quote_status type", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const rpcPromise = client.subscribeQuoteStatus();
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "subscribe",
				params: ["quote_status_extended"],
			});

			ws.simulateRpcResponse(0, "sub-456");
			await rpcPromise;
			client.disconnect();
		});
	});

	describe("unsubscribeQuotes()", () => {
		it("sends unsubscribe request", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const subscribePromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);
			ws.simulateRpcResponse(0, "sub-123");
			await subscribePromise;

			const unsubscribePromise = client.unsubscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "unsubscribe",
				params: ["sub-123"],
			});

			ws.simulateRpcResponse(1, true);
			await unsubscribePromise;
			client.disconnect();
		});
	});

	describe("generic subscribe/unsubscribe/rpc", () => {
		it("subscribe returns subscription ID", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const subscribePromise = client.subscribe("quote_status_extended", {
				solver_id: "my-solver",
			});
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "subscribe",
				params: ["quote_status_extended", { solver_id: "my-solver" }],
			});

			ws.simulateRpcResponse(0, "sub-ext-123");
			const subscriptionId = await subscribePromise;
			expect(subscriptionId).toBe("sub-ext-123");

			client.disconnect();
		});

		it("unsubscribe sends unsubscribe request", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const unsubscribePromise = client.unsubscribe("sub-ext-123");
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "unsubscribe",
				params: ["sub-ext-123"],
			});

			ws.simulateRpcResponse(0, true);
			await unsubscribePromise;
			client.disconnect();
		});

		it("rpc sends generic RPC request", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.rpc<{ version: string }>("get_version", []);
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "get_version",
				params: [],
			});

			ws.simulateRpcResponse(0, { version: "1.0.0" });
			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({ version: "1.0.0" });

			client.disconnect();
		});
	});

	describe("event handling", () => {
		it("emits quote event when receiving QuoteRequest", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const quoteHandler = vi.fn();
			client.on("quote", quoteHandler);

			const quoteRequest = {
				quote_id: "q-123",
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				exact_amount_in: "1000000000000000000",
				min_deadline_ms: 60000,
			};
			ws.simulateEvent("sub-123", quoteRequest, {});

			expect(quoteHandler).toHaveBeenCalledWith(
				{
					quote_id: "q-123",
					defuse_asset_identifier_in: "near:mainnet:wrap.near",
					defuse_asset_identifier_out: "near:mainnet:usdt.near",
					exact_amount_in: "1000000000000000000",
					min_deadline_ms: 60000,
				},
				{},
			);

			client.disconnect();
		});

		it("emits quoteStatus event when receiving QuoteExecution", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const statusHandler = vi.fn();
			client.on("quoteStatus", statusHandler);

			const execution = {
				event_type: "quote_settle_successful",
				quote_hash: "hash-123",
				intent_hash: "intent-456",
				tx_hash: "tx-789",
			};
			ws.simulateEvent("sub-456", execution);

			expect(statusHandler).toHaveBeenCalledWith({
				event_type: "quote_settle_successful",
				quote_hash: "hash-123",
				intent_hash: "intent-456",
				tx_hash: "tx-789",
			});

			client.disconnect();
		});

		it("passes metadata to quote handler", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const quoteHandler = vi.fn();
			client.on("quote", quoteHandler);

			const quoteRequest = {
				quote_id: "q-123",
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				min_deadline_ms: 60000,
			};
			const metadata = { traceparent: "00-trace-span-01" };
			ws.simulateEvent("sub-123", quoteRequest, metadata);

			expect(quoteHandler).toHaveBeenCalledWith(
				expect.objectContaining({ quote_id: "q-123" }),
				expect.objectContaining({ traceparent: "00-trace-span-01" }),
			);

			client.disconnect();
		});

		it("emits streamEvent for unknown event types", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const streamHandler = vi.fn();
			client.on("streamEvent", streamHandler);

			const unknownData = {
				custom_field: "value",
				another_field: 123,
			};
			ws.simulateEvent("sub-unknown", unknownData, { partner_id: "test" });

			expect(streamHandler).toHaveBeenCalledWith("sub-unknown", unknownData, {
				partner_id: "test",
			});

			client.disconnect();
		});
	});

	describe("sendQuoteResponse()", () => {
		it("returns Ok with accepted: true on success", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.sendQuoteResponse({
				quote_id: "q-123",
				quote_output: { amount_out: "1000000" },
			});
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateRpcResponse(0, "OK");

			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({ accepted: true });

			client.disconnect();
		});

		it("returns Ok with accepted: false on RPC error", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.sendQuoteResponse({
				quote_id: "q-123",
				quote_output: { amount_out: "1000000" },
			});
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateRpcError(0, -32001, "Quote expired");

			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({
				accepted: false,
				error: { code: -32001, message: "Quote expired" },
			});

			client.disconnect();
		});

		it("returns Err on connection error", async () => {
			const client = await createClient({ autoReconnect: false });
			const ws = await connectClient(client);

			const resultAsync = client.sendQuoteResponse({
				quote_id: "q-123",
				quote_output: { amount_out: "1000000" },
			});
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateClose();

			const result = await resultAsync;
			expect(result.isErr()).toBe(true);

			client.disconnect();
		});
	});

	describe("sendNoLiquidityResponse()", () => {
		it("sends NO_LIQUIDITY response", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.sendNoLiquidityResponse("q-123");
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "quote_response",
				params: [
					{
						quote_id: "q-123",
						quote_output: { type: "NO_LIQUIDITY" },
					},
				],
			});

			ws.simulateRpcResponse(0, null);
			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			client.disconnect();
		});

		it("supports custom output type", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const { QuoteOutputType } = await import("./types/index.js");
			const resultAsync = client.sendNoLiquidityResponse("q-123", {
				type: QuoteOutputType.INSUFFICIENT_AMOUNT,
			});
			await vi.advanceTimersByTimeAsync(0);

			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "quote_response",
				params: [
					{
						quote_id: "q-123",
						quote_output: { type: "INSUFFICIENT_AMOUNT" },
					},
				],
			});

			ws.simulateRpcResponse(0, null);
			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			client.disconnect();
		});
	});

	describe("requestQuotes()", () => {
		it("returns validated quotes and errors", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.requestQuotes({
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				exact_amount_in: "1000000000000000000",
			});
			await vi.advanceTimersByTimeAsync(0);

			const quote = {
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				amount_in: "1000000000000000000",
				amount_out: "5000000",
				expiration_time: "2025-01-01T00:00:00Z",
				quote_hash: "hash-123",
			};
			ws.simulateRpcResponse(0, [quote]);

			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			const value = result._unsafeUnwrap();
			expect(value.quotes).toEqual([
				{
					defuse_asset_identifier_in: "near:mainnet:wrap.near",
					defuse_asset_identifier_out: "near:mainnet:usdt.near",
					amount_in: "1000000000000000000",
					amount_out: "5000000",
					expiration_time: "2025-01-01T00:00:00Z",
					quote_hash: "hash-123",
				},
			]);
			expect(value.errors).toEqual([]);

			client.disconnect();
		});

		it("separates quotes and errors", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.requestQuotes({
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				exact_amount_in: "1000000000000000000",
			});
			await vi.advanceTimersByTimeAsync(0);

			const quote = {
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				amount_in: "1000000000000000000",
				amount_out: "5000000",
				expiration_time: "2025-01-01T00:00:00Z",
				quote_hash: "hash-123",
			};
			const quoteError = { type: "NO_LIQUIDITY", solver_id: "solver-1" };
			const invalidItem = { invalid: "data" };
			ws.simulateRpcResponse(0, [quote, quoteError, invalidItem]);

			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			const value = result._unsafeUnwrap();
			expect(value.quotes).toHaveLength(1);
			expect(value.errors).toHaveLength(1);
			expect(value.errors[0]?.type).toBe("NO_LIQUIDITY");

			client.disconnect();
		});

		it("returns empty results if response is not an array", async () => {
			const client = await createClient();
			const ws = await connectClient(client);

			const resultAsync = client.requestQuotes({
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				exact_amount_in: "1000000000000000000",
			});
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateRpcResponse(0, null);

			const result = await resultAsync;
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toEqual({ quotes: [], errors: [] });

			client.disconnect();
		});
	});

	describe("reconnection", () => {
		it("emits reconnecting event on connection loss", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const reconnectingHandler = vi.fn();
			client.on("reconnecting", reconnectingHandler);

			ws.simulateClose();
			await vi.advanceTimersByTimeAsync(0);

			expect(reconnectingHandler).toHaveBeenCalledWith(1);

			// Disconnect before reconnect timer fires to avoid unhandled rejection
			client.disconnect();
		});

		it("waits for reconnect delay before attempting reconnection", async () => {
			const client = await createClient();
			await connectClient(client);
			const reconnectingHandler = vi.fn();
			client.on("reconnecting", reconnectingHandler);

			vi.spyOn(Math, "random").mockReturnValue(0);

			// Connection lost
			mockWsInstance?.simulateClose();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconnectingHandler).toHaveBeenCalledWith(1);

			// Before base delay (1000ms) - no new WebSocket created yet
			const wsAfterClose = mockWsInstance;
			await vi.advanceTimersByTimeAsync(999);
			expect(mockWsInstance).toBe(wsAfterClose);

			// After delay - new connection attempt starts
			await vi.advanceTimersByTimeAsync(1);
			expect(mockWsInstance).not.toBe(wsAfterClose);

			// Complete reconnection to avoid unhandled rejection
			mockWsInstance?.simulateOpen();
			await vi.advanceTimersByTimeAsync(0);
			client.disconnect();
		});

		it("stops reconnecting after maxReconnectAttempts", async () => {
			const client = await createClient({ maxReconnectAttempts: 2 });
			await connectClient(client);
			const reconnectingHandler = vi.fn();
			client.on("reconnecting", reconnectingHandler);

			vi.spyOn(Math, "random").mockReturnValue(0);

			// First disconnect
			mockWsInstance?.simulateClose();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconnectingHandler).toHaveBeenCalledTimes(1);

			// Reconnect attempt 1
			await vi.advanceTimersByTimeAsync(1000);
			mockWsInstance?.simulateOpen();
			await vi.advanceTimersByTimeAsync(0);
			mockWsInstance?.simulateClose();
			await vi.advanceTimersByTimeAsync(0);
			expect(reconnectingHandler).toHaveBeenCalledTimes(2);

			// Reconnect attempt 2 - let it time out by disconnecting first
			client.disconnect();

			expect(reconnectingHandler).toHaveBeenCalledTimes(2);
		});

		it("restores subscriptions after reconnect", async () => {
			const client = await createClient();
			let ws = await connectClient(client);

			const subscribePromise = client.subscribeQuotes({ chains: ["near"] });
			await vi.advanceTimersByTimeAsync(0);
			ws.simulateRpcResponse(0, "sub-old");
			await subscribePromise;

			vi.spyOn(Math, "random").mockReturnValue(0);

			// Disconnect
			ws.simulateClose();
			await vi.advanceTimersByTimeAsync(0);

			// Reconnect
			await vi.advanceTimersByTimeAsync(1000);
			if (!mockWsInstance) throw new Error("MockWebSocket not created");
			ws = mockWsInstance;
			ws.sentMessages = [];
			ws.simulateOpen();
			await vi.advanceTimersByTimeAsync(0);

			// Should have sent new subscribe request with filters
			const msg = ws.getLastSentMessage();
			expect(msg).toMatchObject({
				method: "subscribe",
				params: ["quote", { chains: ["near"] }],
			});

			// Complete the subscribe RPC to avoid unhandled rejection
			ws.simulateRpcResponse(0, "sub-new");
			await vi.advanceTimersByTimeAsync(0);
			client.disconnect();
		});

		it("does not reconnect when autoReconnect is false", async () => {
			const client = await createClient({ autoReconnect: false });
			const ws = await connectClient(client);
			const reconnectingHandler = vi.fn();
			client.on("reconnecting", reconnectingHandler);

			ws.simulateClose();
			await vi.advanceTimersByTimeAsync(60000);

			expect(reconnectingHandler).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("emits ValidationError for invalid JSON", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const errorHandler = vi.fn();
			client.on("error", errorHandler);

			ws.emit("message", Buffer.from("not json"));

			expect(errorHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining("Failed to parse"),
				}),
			);

			client.disconnect();
		});

		it("emits ValidationError for unknown message format", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const errorHandler = vi.fn();
			client.on("error", errorHandler);

			ws.simulateMessage({ unknown: "format" });

			expect(errorHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.stringContaining("Unknown message format"),
				}),
			);

			client.disconnect();
		});

		it("rejects pending requests on connection loss", async () => {
			const client = await createClient({ autoReconnect: false });
			const ws = await connectClient(client);
			const errorHandler = vi.fn();
			client.on("error", errorHandler);

			const rpcPromise = client.subscribeQuotes();
			await vi.advanceTimersByTimeAsync(0);

			ws.simulateClose();

			await expect(rpcPromise).rejects.toThrow("Connection lost");
		});
	});

	describe("looseObject validation (forward compatibility)", () => {
		it("accepts quote requests with extra unknown fields", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const quoteHandler = vi.fn();
			client.on("quote", quoteHandler);

			// Quote request with extra fields that don't exist in current schema
			const quoteRequestWithExtras = {
				quote_id: "q-123",
				defuse_asset_identifier_in: "near:mainnet:wrap.near",
				defuse_asset_identifier_out: "near:mainnet:usdt.near",
				min_deadline_ms: 60000,
				// Extra fields that might be added in future protocol versions
				future_field_1: "some value",
				future_field_2: 12345,
				nested_extra: { foo: "bar" },
			};
			ws.simulateEvent("sub-123", quoteRequestWithExtras, {});

			expect(quoteHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					quote_id: "q-123",
					defuse_asset_identifier_in: "near:mainnet:wrap.near",
				}),
				{},
			);

			client.disconnect();
		});

		it("accepts quote execution with extra unknown fields", async () => {
			const client = await createClient();
			const ws = await connectClient(client);
			const statusHandler = vi.fn();
			client.on("quoteStatus", statusHandler);

			const executionWithExtras = {
				event_type: "quote_settle_successful",
				quote_hash: "hash-123",
				intent_hash: "intent-456",
				tx_hash: "tx-789",
				// Extra fields
				block_height: 123456,
				gas_used: "1000000",
			};
			ws.simulateEvent("sub-456", executionWithExtras);

			expect(statusHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					quote_hash: "hash-123",
					intent_hash: "intent-456",
					tx_hash: "tx-789",
				}),
			);

			client.disconnect();
		});
	});
});

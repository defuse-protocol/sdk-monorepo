import { EventEmitter } from "node:events";
import * as v from "valibot";
import {
	ConnectionError,
	RelayRpcError,
	RequestTimeoutError,
	ValidationError,
} from "../errors/index.js";
import type { Transport } from "../transport/types.js";
import { JsonRpcNotificationSchema, JsonRpcResponseSchema } from "./schemas.js";
import type {
	JsonRpcProtocolOptions,
	JsonRpcRequest,
	Protocol,
	ProtocolEvents,
} from "./types.js";

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
	timeout: NodeJS.Timeout;
	method: string;
}

/**
 * JSON-RPC 2.0 protocol handler.
 *
 * Responsibilities:
 * - Assign unique IDs to outgoing requests
 * - Match responses to pending requests
 * - Handle request timeouts
 * - Route notifications to event handlers
 */
export class JsonRpcProtocol
	extends EventEmitter<ProtocolEvents>
	implements Protocol
{
	private requestCounter = 0;
	private pendingRequests = new Map<number, PendingRequest>();
	private readonly transport: Transport;
	private readonly requestTimeout: number;

	constructor(transport: Transport, options?: JsonRpcProtocolOptions) {
		super();
		this.transport = transport;
		this.requestTimeout = options?.requestTimeout ?? 10000;

		this.transport.on("message", (data) => this.handleMessage(data));
		this.transport.on("close", () => this.handleTransportClose());
	}

	request<T>(method: string, params?: unknown[]): Promise<T> {
		return new Promise((resolve, reject) => {
			if (!this.transport.isConnected()) {
				reject(new ConnectionError("WebSocket is not connected"));
				return;
			}

			const id = this.requestCounter++;
			const request: JsonRpcRequest = {
				jsonrpc: "2.0",
				id,
				method,
				params,
			};

			const timeout = setTimeout(() => {
				this.pendingRequests.delete(id);
				reject(
					new RequestTimeoutError(
						`Request '${method}' timed out after ${this.requestTimeout}ms`,
						{ props: { method, timeoutMs: this.requestTimeout } },
					),
				);
			}, this.requestTimeout);

			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeout,
				method,
			});

			try {
				this.transport.send(JSON.stringify(request));
			} catch (err) {
				clearTimeout(timeout);
				this.pendingRequests.delete(id);
				reject(new ConnectionError("Failed to send", { cause: err }));
			}
		});
	}

	/**
	 * Called after transport reconnects - resets request counter for new session.
	 */
	onTransportReconnected(): void {
		this.requestCounter = 0;
	}

	/**
	 * Reset protocol state - called on disconnect.
	 */
	reset(): void {
		for (const [id, pending] of this.pendingRequests) {
			clearTimeout(pending.timeout);
			pending.reject(new ConnectionError("Client disconnected"));
			this.pendingRequests.delete(id);
		}
	}

	private handleMessage(data: string): void {
		let message: unknown;
		try {
			message = JSON.parse(data);
		} catch {
			this.emit("error", new ValidationError("Failed to parse message"));
			return;
		}

		// Check if it's a JSON-RPC response
		if (v.is(JsonRpcResponseSchema, message)) {
			this.handleResponse(message);
			return;
		}

		// Check if it's a notification
		if (v.is(JsonRpcNotificationSchema, message)) {
			this.emit("notification", message.method, message.params);
			return;
		}

		this.emit(
			"error",
			new ValidationError(`Unknown message format: ${JSON.stringify(message)}`),
		);
	}

	private handleResponse(
		response: v.InferOutput<typeof JsonRpcResponseSchema>,
	): void {
		const pending = this.pendingRequests.get(response.id);
		if (!pending) {
			return;
		}

		clearTimeout(pending.timeout);
		this.pendingRequests.delete(response.id);

		if (response.error) {
			pending.reject(
				new RelayRpcError(response.error.message, {
					props: { code: response.error.code, data: response.error.data },
				}),
			);
		} else {
			pending.resolve(response.result);
		}
	}

	private handleTransportClose(): void {
		for (const pending of this.pendingRequests.values()) {
			clearTimeout(pending.timeout);
			pending.reject(new ConnectionError("Connection lost"));
		}
		this.pendingRequests.clear();
	}
}

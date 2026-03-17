import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { ConnectionError } from "../errors/index.js";
import {
	ConnectionState,
	type Transport,
	type TransportEvents,
	type WebSocketTransportOptions,
} from "./types.js";

/**
 * WebSocket transport with automatic reconnection.
 *
 * Handles raw WebSocket connection lifecycle including:
 * - Connection with optional JWT auth
 * - Automatic reconnection with exponential backoff
 * - Connection state tracking
 */
export class WebSocketTransport
	extends EventEmitter<TransportEvents>
	implements Transport
{
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
	private reconnectTimer: NodeJS.Timeout | null = null;

	private readonly wsUrl: string;
	private readonly jwt?: string;
	private readonly autoReconnect: boolean;
	private readonly reconnectDelay: number;
	private readonly maxReconnectAttempts: number;
	private readonly connectTimeout: number;

	constructor(options: WebSocketTransportOptions) {
		super();
		this.wsUrl = options.wsUrl;
		this.jwt = options.jwt;
		this.autoReconnect = options.autoReconnect ?? true;
		this.reconnectDelay = options.reconnectDelay ?? 1000;
		this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
		this.connectTimeout = options.connectTimeout ?? 30000;
	}

	connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.connectionState === ConnectionState.CONNECTED) {
				resolve();
				return;
			}

			if (this.connectionState === ConnectionState.CONNECTING) {
				reject(new ConnectionError("Connection already in progress"));
				return;
			}

			this.connectionState = ConnectionState.CONNECTING;

			if (this.ws) {
				this.ws.removeAllListeners();
				this.ws.close();
				this.ws = null;
			}

			const headers: Record<string, string> = {};
			if (this.jwt) {
				headers.Authorization = `Bearer ${this.jwt}`;
			}

			this.ws = new WebSocket(this.wsUrl, { headers });

			const onOpen = () => {
				cleanup();
				this.connectionState = ConnectionState.CONNECTED;
				this.reconnectAttempts = 0;
				this.emit("open");
				resolve();
			};

			const onError = (error: Error) => {
				cleanup();
				this.connectionState = ConnectionState.DISCONNECTED;
				reject(error);
			};

			const onClose = () => {
				cleanup();
				this.connectionState = ConnectionState.DISCONNECTED;
				reject(new ConnectionError("Connection closed before open"));
			};

			const connectTimer = setTimeout(() => {
				cleanup();
				this.connectionState = ConnectionState.DISCONNECTED;
				if (this.ws) {
					this.ws.removeAllListeners();
					this.ws.close();
					this.ws = null;
				}
				reject(new ConnectionError("Connection timed out"));
			}, this.connectTimeout);

			const cleanup = () => {
				clearTimeout(connectTimer);
				this.ws?.removeListener("open", onOpen);
				this.ws?.removeListener("error", onError);
				this.ws?.removeListener("close", onClose);
			};

			this.ws.on("open", onOpen);
			this.ws.once("error", onError);
			this.ws.once("close", onClose);

			// Permanent handlers after initial connection
			this.ws.on("message", (data) => this.handleMessage(data));
			this.ws.on("error", (error) => this.emit("error", error));
			this.ws.on("close", () => this.handleClose());
		});
	}

	disconnect(): void {
		this.connectionState = ConnectionState.DISCONNECTED;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.ws) {
			this.ws.removeAllListeners();
			this.ws.close();
			this.ws = null;
		}

		this.emit("close");
	}

	send(data: string): void {
		const ws = this.ws;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			throw new ConnectionError("WebSocket is not connected");
		}
		ws.send(data);
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	private handleMessage(data: WebSocket.RawData): void {
		this.emit("message", data.toString());
	}

	private handleClose(): void {
		const wasConnected = this.connectionState === ConnectionState.CONNECTED;
		this.ws = null;

		if (this.connectionState === ConnectionState.DISCONNECTED) {
			return;
		}

		if (wasConnected) {
			this.emit("close", new ConnectionError("Connection lost"));
		}

		if (
			this.autoReconnect &&
			this.reconnectAttempts < this.maxReconnectAttempts
		) {
			this.connectionState = ConnectionState.RECONNECTING;
			this.reconnectAttempts++;
			this.emit("reconnecting", this.reconnectAttempts);

			// Exponential backoff with jitter
			const exponentialDelay =
				this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);
			const maxDelay = 30000;
			const jitter = Math.random() * 1000;
			const delay = Math.min(exponentialDelay, maxDelay) + jitter;

			this.reconnectTimer = setTimeout(() => {
				this.reconnectTimer = null;
				this.connect().catch((error) => {
					this.emit("error", error);
				});
			}, delay);
		} else {
			this.connectionState = ConnectionState.DISCONNECTED;
		}
	}
}

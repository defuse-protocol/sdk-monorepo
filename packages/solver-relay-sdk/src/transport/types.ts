import type { EventEmitter } from "node:events";

/**
 * Transport connection state
 */
export const ConnectionState = {
	DISCONNECTED: "disconnected",
	CONNECTING: "connecting",
	CONNECTED: "connected",
	RECONNECTING: "reconnecting",
} as const;

export type ConnectionState =
	(typeof ConnectionState)[keyof typeof ConnectionState];

/**
 * Events emitted by the transport layer
 */
export interface TransportEvents {
	open: [];
	close: [error?: Error];
	message: [data: string];
	reconnecting: [attempt: number];
	error: [error: Error];
}

/**
 * Transport layer interface - handles raw connection
 */
export interface Transport extends EventEmitter<TransportEvents> {
	connect(): Promise<void>;
	disconnect(): void;
	send(data: string): void;
	isConnected(): boolean;
}

/**
 * Options for WebSocket transport
 */
export interface WebSocketTransportOptions {
	wsUrl: string;
	jwt?: string;
	autoReconnect?: boolean;
	reconnectDelay?: number;
	maxReconnectAttempts?: number;
	connectTimeout?: number;
}

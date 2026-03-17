import type { EventEmitter } from "node:events";

/**
 * JSON-RPC 2.0 request
 */
export interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown[];
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

/**
 * JSON-RPC 2.0 response
 */
export interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 notification (no id)
 */
export interface JsonRpcNotification<P = unknown> {
	jsonrpc: "2.0";
	method: string;
	params?: P;
}

/**
 * Events emitted by the protocol layer
 */
export interface ProtocolEvents {
	notification: [method: string, params: unknown];
	error: [error: Error];
}

/**
 * Protocol layer interface - handles JSON-RPC request/response matching
 */
export interface Protocol extends EventEmitter<ProtocolEvents> {
	request<T>(method: string, params?: unknown[]): Promise<T>;
	onTransportReconnected(): void;
	reset(): void;
}

/**
 * Options for JSON-RPC protocol
 */
export interface JsonRpcProtocolOptions {
	requestTimeout?: number;
}

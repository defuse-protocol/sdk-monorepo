import { serialize } from "../utils/serialize";
import { BaseError } from "./base";

export type HttpRequestErrorType = HttpRequestError & {
	name: "HttpRequestError";
};
export class HttpRequestError extends BaseError {
	body?: unknown | undefined;
	headers?: Headers | undefined;
	status?: number | undefined;
	url: string;

	constructor({
		body,
		cause,
		details,
		headers,
		status,
		url,
	}: {
		body?: unknown | undefined;
		cause?: Error | undefined;
		details?: string | undefined;
		headers?: Headers | undefined;
		status?: number | undefined;
		url: string;
	}) {
		super("HTTP request failed.", {
			cause,
			details,
			metaMessages: [
				status && `Status: ${status}`,
				`URL: ${url}`,
				body && `Request body: ${serialize(body)}`,
			].filter(Boolean) as string[],
			name: "HttpRequestError",
		});
		this.body = body;
		this.headers = headers;
		this.status = status;
		this.url = url;
	}
}

export type RpcRequestErrorType = RpcRequestError & {
	name: "RpcRequestError";
};
export class RpcRequestError extends BaseError {
	code: number;
	data?: unknown;

	constructor({
		body,
		error,
		url,
	}: {
		body: unknown;
		error: { code: number; data?: unknown; message: string };
		url: string;
	}) {
		super("RPC Request failed.", {
			cause: error as unknown,
			details: error.message,
			metaMessages: [`URL: ${url}`, `Request body: ${serialize(body)}`],
			name: "RpcRequestError",
		});
		this.code = error.code;
		this.data = error.data;
	}
}

export type TimeoutErrorType = TimeoutError & {
	name: "TimeoutError";
};
export class TimeoutError extends BaseError {
	constructor({
		body,
		url,
	}: {
		body: unknown;
		url: string;
	}) {
		super("The request took too long to respond.", {
			details: "The request timed out.",
			metaMessages: [`URL: ${url}`, `Request body: ${serialize(body)}`],
			name: "TimeoutError",
		});
	}
}

export type JsonDeserializationErrorType = JsonDeserializationError & {
	name: "JsonDeserializationError";
};
export class JsonDeserializationError extends BaseError {
	constructor({
		body,
		cause,
		url,
	}: {
		body: unknown;
		cause: Error;
		url: string;
	}) {
		super("Failed to deserialize the response as JSON.", {
			cause,
			details: cause.message,
			metaMessages: [`URL: ${url}`, `Request body: ${serialize(body)}`],
			name: "JsonDeserializationError",
		});
	}
}

export type JsonParsingErrorType = JsonParsingError & {
	name: "JsonParsingError";
};
export class JsonParsingError extends BaseError {
	issues: ReadonlyArray<unknown>;

	constructor({
		body,
		issues,
		url,
	}: {
		body: unknown;
		issues: ReadonlyArray<unknown>;
		url: string;
	}) {
		super("Failed to parse the response.", {
			details: "Response parsing error.",
			metaMessages: [
				`URL: ${url}`,
				`Request body: ${serialize(body)}`,
				`Issues: ${serialize(issues)}`,
			],
			name: "JsonParsingError",
		});
		this.issues = issues;
	}
}

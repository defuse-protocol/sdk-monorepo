import { base64 } from "@scure/base";

export interface RpcEndpointConfig {
	url: string;
	headers?: Record<string, string>;
}

export type RpcEndpoint = string | RpcEndpointConfig;

/**
 * Parses URL with embedded credentials (http://user:pass@host) and extracts
 * Authorization header. Returns cleaned URL without credentials.
 */
export function parseUrlCredentials(urlString: string): {
	url: string;
	headers: Record<string, string>;
} {
	const url = new URL(urlString);
	const headers: Record<string, string> = {};

	if (url.username || url.password) {
		const credentials = `${url.username}:${url.password}`;
		headers.Authorization = `Basic ${base64.encode(new TextEncoder().encode(credentials))}`;

		// Remove credentials from URL
		url.username = "";
		url.password = "";

		return { url: url.toString(), headers };
	}

	// No credentials - return original URL to avoid normalization (trailing slashes, etc.)
	return { url: urlString, headers };
}

/**
 * Normalizes RpcEndpoint to RpcEndpointConfig, parsing credentials from URL if present.
 */
export function normalizeRpcEndpoint(endpoint: RpcEndpoint): RpcEndpointConfig {
	const config = typeof endpoint === "string" ? { url: endpoint } : endpoint;
	const { url, headers: parsedHeaders } = parseUrlCredentials(config.url);

	return {
		url,
		headers: { ...parsedHeaders, ...config.headers },
	};
}

/**
 * Extracts plain URLs from RpcEndpoint array.
 * Use this when passing RPC endpoints to external SDKs that only support URL strings.
 *
 * @note This strips credentials from URLs. For credential-containing URLs,
 * use normalizeRpcEndpoint() to properly convert them to auth headers.
 */
export function extractRpcUrls(endpoints: RpcEndpoint[]): string[] {
	return endpoints.map((endpoint) => {
		const url = typeof endpoint === "string" ? endpoint : endpoint.url;
		return parseUrlCredentials(url).url;
	});
}

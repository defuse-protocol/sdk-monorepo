import { providers } from "near-api-js";
import { type RpcEndpoint, normalizeRpcEndpoint } from "./rpc-endpoint";

/**
 * Creates a NEAR failover RPC provider from a list of endpoints.
 *
 * @note This function is specifically designed for NEAR RPC providers
 * and should not be used with other blockchain networks.
 *
 * Supports:
 * - Plain URL strings: "https://rpc.example.com"
 * - URLs with embedded credentials: "http://user:pass@host:3030" (auto-converted to Authorization header)
 * - Config objects: { url: "https://rpc.example.com", headers: { "Authorization": "..." } }
 */
export function nearFailoverRpcProvider({ urls }: { urls: RpcEndpoint[] }) {
	const providers_ = urls.map((endpoint) => {
		const { url, headers } = normalizeRpcEndpoint(endpoint);
		return new providers.JsonRpcProvider({ url, headers });
	});
	return createNearFailoverRpcProvider({ providers: providers_ });
}

export function createNearFailoverRpcProvider({
	providers: list,
}: {
	providers: providers.JsonRpcProvider[];
}) {
	return new providers.FailoverRpcProvider(list);
}

export function unwrapNearFailoverRpcProvider(
	provider: providers.Provider,
): providers.Provider {
	if (
		provider instanceof providers.FailoverRpcProvider &&
		provider.providers.length > 0 &&
		provider.providers[0]
	) {
		return provider.providers[0];
	}
	return provider;
}

import { providers } from "near-api-js";
import { FailoverRpcProvider, type Provider } from "near-api-js/lib/providers";

/**
 * @note This function is specifically designed for NEAR RPC providers and should not be used with other blockchain networks.
 * It creates a failover provider that will automatically switch between the provided RPC endpoints if one fails.
 */
export function nearFailoverRpcProvider({ urls }: { urls: string[] }) {
	const providers_ = urls.map((url) => new providers.JsonRpcProvider({ url }));
	return createNearFailoverRpcProvider({ providers: providers_ });
}

export function createNearFailoverRpcProvider({
	providers: list,
}: {
	providers: providers.JsonRpcProvider[];
}) {
	return new providers.FailoverRpcProvider(list);
}

export function unwrapNearFailoverRpcProvider(provider: Provider): Provider {
	if (
		provider instanceof FailoverRpcProvider &&
		provider.providers.length > 0 &&
		provider.providers[0]
	) {
		return provider.providers[0];
	}
	return provider;
}

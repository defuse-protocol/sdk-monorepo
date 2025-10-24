import { FailoverRpcProvider, type Provider } from "near-api-js/lib/providers";

export default function unwrapNearFailoverProvider(
	provider: Provider,
): Provider {
	if (
		provider instanceof FailoverRpcProvider &&
		provider.providers.length > 0 &&
		provider.providers[0]
	) {
		return provider.providers[0];
	}
	return provider;
}

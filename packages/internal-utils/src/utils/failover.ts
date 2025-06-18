import { providers } from "near-api-js"
import { FailoverRpcProvider } from "near-api-js/lib/providers"

/**
 * @note This function is specifically designed for NEAR RPC providers and should not be used with other blockchain networks.
 * It creates a failover provider that will automatically switch between the provided RPC endpoints if one fails.
 */
export function nearFailoverRpcProvider({ urls }: { urls: string[] }) {
  const providers_ = urls.map((url) => new providers.JsonRpcProvider({ url }))
  return createNearFailoverRpcProvider({ providers: providers_ })
}

export function createNearFailoverRpcProvider({
  providers,
}: { providers: providers.JsonRpcProvider[] }) {
  return new FailoverRpcProvider(providers)
}

import { jsonRPCRequest } from "./runtime"
import type * as types from "./types"

export async function quote(
  params: types.QuoteRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.QuoteResponse["result"]> {
  const result = await jsonRPCRequest<types.QuoteRequest>(
    "quote",
    params,
    config
  )
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  return result as any
}

export async function publishIntent(
  params: types.PublishIntentRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.PublishIntentResponse["result"]> {
  const result = await jsonRPCRequest<types.PublishIntentRequest>(
    "publish_intent",
    params,
    config
  )
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  return result as any
}

export async function publishIntents(
  params: types.PublishIntentsRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.PublishIntentsResponse["result"]> {
  const result = await jsonRPCRequest<types.PublishIntentsRequest>(
    "publish_intents",
    params,
    config
  )
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  return result as any
}

export async function getStatus(
  params: types.GetStatusRequest["params"][0],
  config: types.RequestConfig = {}
): Promise<types.GetStatusResponse["result"]> {
  const result = await jsonRPCRequest<types.GetStatusRequest>(
    "get_status",
    params,
    config
  )
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  return result as any
}

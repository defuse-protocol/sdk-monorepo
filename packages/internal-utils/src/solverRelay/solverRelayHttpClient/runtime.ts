import { retry } from "@lifeomic/attempt";
import * as v from "valibot";
import { config as globalConfig } from "../../config";
import { handleRPCResponse } from "../../utils/handleRPCResponse";
import { request } from "../../utils/request";
import { requestShouldRetry } from "../../utils/requestShouldRetry";
import type * as types from "./types";

const rpcResponseSchema = v.union([
	// success
	v.object({
		jsonrpc: v.literal("2.0"),
		id: v.string(),
		result: v.unknown(),
	}),
	// error
	v.object({
		jsonrpc: v.literal("2.0"),
		id: v.string(),
		error: v.pipe(
			v.object({
				code: v.number(),
				message: v.string(),
			}),
			v.transform((v) => {
				return {
					code: v.code,
					data: null,
					message: v.message,
				};
			}),
		),
	}),
]);

export async function jsonRPCRequest<
	T extends types.JSONRPCRequest<unknown, unknown>,
>(
	method: T["method"],
	params: T["params"][0],
	config?: types.RequestConfig | undefined,
) {
	const url = `${globalConfig.env.solverRelayBaseURL}/rpc`;

	const body = {
		id: config?.requestId ?? "dontcare",
		jsonrpc: "2.0",
		method,
		params: params !== undefined ? [params] : undefined,
	};

	const response = await retry(
		() => {
			return request({
				url,
				body,
				...config,
				fetchOptions: {
					...config?.fetchOptions,
					method: "POST",
				},
			});
		},
		{
			delay: 200,
			maxAttempts: 3,
			handleError: (err, context) => {
				if (!requestShouldRetry(err)) {
					context.abort;
				}
			},
		},
	);

	return handleRPCResponse(response, body, rpcResponseSchema);
}

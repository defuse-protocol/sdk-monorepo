import type * as v from "valibot";
import { handleResponse } from "../../utils/handleResponse";
import { request } from "../../utils/request";
import { RETRY_CONFIGS } from "../../utils/retry";
import type { RequestConfig } from "./types";

export async function xrplRequest<
	TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
	method: string,
	params: Record<string, unknown>,
	config: RequestConfig,
	schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
	const body = {
		method,
		params: [params],
	};

	const response = await request({
		url: config.baseURL,
		body,
		timeout: config.timeout,
		retryOptions: config.retryOptions ?? RETRY_CONFIGS.THIRTY_SECS_AGGRESSIVE,
		logger: config.logger,
		fetchOptions: {
			...config.fetchOptions,
			method: "POST",
		},
	});

	return handleResponse(response, body, schema);
}

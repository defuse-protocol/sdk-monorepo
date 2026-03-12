import { request } from "../../utils/request";
import { RETRY_CONFIGS } from "../../utils/retry";
import type { RequestConfig } from "./types";

export async function xrplRequest(
	method: string,
	params: Record<string, unknown>,
	config: RequestConfig,
): Promise<unknown> {
	const body = {
		method,
		params: [params],
	};

	const response = await request({
		url: config.baseURL,
		body,
		timeout: config.timeout,
		retryOptions: config?.retryOptions ?? RETRY_CONFIGS.THIRTY_SECS_AGGRESSIVE,
		logger: config.logger,
		fetchOptions: {
			method: "POST",
		},
	});

	return response.json();
}

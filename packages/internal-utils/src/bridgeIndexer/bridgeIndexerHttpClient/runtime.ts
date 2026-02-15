import type * as v from "valibot";
import { config as globalConfig } from "../../config";
import { handleResponse } from "../../utils/handleResponse";
import { request } from "../../utils/request";
import type { RequestConfig } from "./types";

export async function httpRequest<
	TSchema extends v.BaseSchema<TInput, TOutput, TIssue>,
	TInput,
	TOutput,
	TIssue extends v.BaseIssue<unknown>,
>(
	path: string,
	searchParams: Record<string, string> | undefined,
	config: RequestConfig | undefined,
	schema: TSchema,
): Promise<TOutput> {
	// Use config.envConfig if provided, otherwise fall back to global config
	const baseURL = config?.baseUrl ?? globalConfig.env.bridgeIndexerURL;
	const url = new URL(path, baseURL);
	if (searchParams) {
		for (const [key, value] of Object.entries(searchParams)) {
			url.searchParams.set(key, value);
		}
	}

	const response = await request({
		url,
		timeout: config?.timeout,
		fetchOptions: config?.fetchOptions,
		retryOptions: config?.retryOptions,
		logger: config?.logger,
	});

	return handleResponse(response, undefined, schema);
}

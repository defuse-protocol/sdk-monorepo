import * as v from "valibot";
import { request } from "../../utils/request";
import { RETRY_CONFIGS } from "../../utils/retry";
import type { RequestConfig } from "./types";
import { HttpRequestError } from "../../errors";
import { serialize } from "../../utils/serialize";

export async function horizonRequest<
	TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
	path: string,
	config: RequestConfig,
	schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
	const url = new URL(path, config.baseURL);

	const response = await request({
		url,
		timeout: config.timeout,
		retryOptions: config.retryOptions ?? RETRY_CONFIGS.THIRTY_SECS_AGGRESSIVE,
		logger: config.logger,
		fetchOptions: {
			...config.fetchOptions,
			method: "GET",
		},
	});

	let json: unknown;
	try {
		json = await response.json();
	} catch (error) {
		throw new HttpRequestError({
			details: "Failed to deserialize JSON",
			cause: error instanceof Error ? error : new Error(String(error)),
			url: response.url,
		});
	}

	const parsed = v.safeParse(schema, json);
	if (parsed.success) {
		return parsed.output;
	}

	throw new HttpRequestError({
		details: "Failed to parse response JSON",
		cause: new Error(serialize(parsed.issues)),
		url: response.url,
	});
}

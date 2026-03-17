import * as v from "valibot";
import { request } from "../../utils/request";
import { RETRY_CONFIGS } from "../../utils/retry";
import { XrplErrorResponseSchema, type RequestConfig } from "./types";
import { HttpRequestError } from "../../errors";
import { serialize } from "../../utils/serialize";
import { XrplAccountNotFundedError, XrplApiError } from "./errors";

export async function xrplRequest<
	TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(
	method: string,
	params: Record<string, unknown>,
	config: RequestConfig,
	schema: TSchema,
): Promise<v.InferOutput<TSchema>> {
	params.api_version = 2;
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

	let json: unknown;
	try {
		json = await response.json();
	} catch (error) {
		throw new HttpRequestError({
			body,
			details: "Failed to deserialize JSON",
			cause: error instanceof Error ? error : new Error(String(error)),
			url: response.url,
		});
	}

	const parsedError = v.safeParse(XrplErrorResponseSchema, json);
	if (parsedError.success) {
		const output = parsedError.output.result;
		if (output.error_code === 19 && output.account) {
			throw new XrplAccountNotFundedError(output.account);
		}
		throw new XrplApiError(output);
	}

	const parsed = v.safeParse(schema, json);
	if (parsed.success) {
		return parsed.output;
	}

	throw new HttpRequestError({
		body,
		details: "Failed to parse response JSON",
		cause: new Error(serialize(parsed.issues)),
		url: response.url,
	});
}

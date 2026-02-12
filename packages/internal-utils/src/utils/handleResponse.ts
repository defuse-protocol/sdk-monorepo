import * as v from "valibot";
import { HttpRequestError } from "../errors/request";

type SuccessResult<result> = {
	result: result;
	error?: undefined;
};
type ErrorResult<error> = {
	result?: undefined;
	error: error;
};
export type RpcResponse<TResult = unknown, TError = unknown> = {
	jsonrpc: `${number}`;
	id: number | string;
} & (SuccessResult<TResult> | ErrorResult<TError>);

export async function handleResponse<
	TSchema extends v.BaseSchema<TInput, TOutput, TIssue>,
	TInput,
	TOutput,
	TIssue extends v.BaseIssue<unknown>,
>(response: Response, body: unknown, schema: TSchema): Promise<TOutput> {
	const json = await response.json();

	const parsed = v.safeParse(schema, json);
	if (parsed.success) {
		return parsed.output;
	}

	throw new HttpRequestError({
		body,
		details: "Response validation failed",
		status: response.status,
		url: response.url,
	});
}

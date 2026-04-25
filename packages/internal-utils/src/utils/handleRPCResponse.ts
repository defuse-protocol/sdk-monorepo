import * as v from "valibot";
import { AuthError, RpcRequestError } from "../errors/request";

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

const AUTH_ERROR_CODE = 401;

export async function handleRPCResponse<
	TSchema extends v.BaseSchema<TInput, TOutput, TIssue>,
	TInput,
	TOutput extends RpcResponse<
		unknown,
		{ code: number; data: unknown; message: string }
	>,
	TIssue extends v.BaseIssue<unknown>,
>(response: Response, body: unknown, schema: TSchema) {
	const json = await response.json();

	const parsed = v.safeParse(schema, json);

	if (!parsed.success) {
		throw new RpcRequestError({
			body,
			error: { code: -1, data: json, message: "Invalid response" },
			url: response.url,
		});
	}

	const { error } = parsed.output;
	if (error === undefined) return parsed.output.result;

	if (error.code === AUTH_ERROR_CODE) {
		throw new AuthError({
			body,
			status: error.code,
			url: response.url,
		});
	}

	throw new RpcRequestError({
		body,
		error: { code: -1, data: json, message: "Invalid response" },
		url: response.url,
	});
}

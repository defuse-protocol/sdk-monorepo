import * as v from "valibot";
import { HttpRequestError } from "../errors/request";
import { serialize } from "./serialize";

export async function handleResponse<
	TSchema extends v.BaseSchema<TInput, TOutput, TIssue>,
	TInput,
	TOutput,
	TIssue extends v.BaseIssue<unknown>,
>(response: Response, body: unknown, schema: TSchema): Promise<TOutput> {
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

import * as v from "valibot";
import { JsonDeserializationError, JsonParsingError } from "../errors/request";

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
		throw new JsonDeserializationError({
			body,
			error: error instanceof Error ? error : new Error(String(error)),
			url: response.url,
		});
	}

	const parsed = v.safeParse(schema, json);
	if (parsed.success) {
		return parsed.output;
	}

	throw new JsonParsingError({
		body,
		error: parsed.issues,
		url: response.url,
	});
}

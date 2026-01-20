import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";

export type { StandardSchemaV1 };

export type ValidationResult<Output> = StandardSchemaV1.Result<Output>;
export type ValidationIssue = StandardSchemaV1.Issue;

export interface Validator<Input, Output>
	extends StandardSchemaV1<Input, Output> {
	readonly validate: (value: unknown) => ValidationResult<Output>;
	readonly schema: AnySchema;
}

/** Extracts the input type from a Validator */
export type InferInput<V> = V extends Validator<infer I, unknown> ? I : never;

/** Extracts the output type from a Validator */
export type InferOutput<V> = V extends Validator<unknown, infer O> ? O : never;

function cloneDeep<T>(value: T): ValidationResult<T> {
	try {
		return { value: JSON.parse(JSON.stringify(value)) };
	} catch (err: unknown) {
		const message =
			err instanceof Error ? err.message : "Value is not JSON-serializable";
		return { issues: [{ message }] };
	}
}

function ajvErrorToIssue(error: ErrorObject): ValidationIssue {
	const path: (string | number)[] = [];
	if (error.instancePath) {
		for (const segment of error.instancePath.split("/").filter(Boolean)) {
			const asNumber = Number(segment);
			path.push(Number.isNaN(asNumber) ? segment : asNumber);
		}
	}
	return {
		message: error.message ?? "Validation failed",
		path: path.length > 0 ? path : undefined,
	};
}

export function wrapValidator<Input, Output>(
	compileValidator: () => ValidateFunction<Output>,
	shouldClone = false,
): Validator<Input, Output> {
	let cached: ValidateFunction<Output> | null = null;

	function getValidator(): ValidateFunction<Output> {
		if (!cached) {
			cached = compileValidator();
		}
		return cached;
	}

	function validate(value: unknown): ValidationResult<Output> {
		const validateFunction = getValidator();
		if (shouldClone) {
			const cloneResult = cloneDeep(value);
			if (cloneResult.issues) {
				return cloneResult;
			}
			if (validateFunction(cloneResult.value)) {
				return { value: cloneResult.value };
			}
		} else {
			if (validateFunction(value)) {
				return { value };
			}
		}
		const issues = (validateFunction.errors ?? []).map((error) =>
			ajvErrorToIssue(error),
		);
		return { issues };
	}

	return {
		validate,
		get schema() {
			return getValidator().schema;
		},
		"~standard": {
			version: 1,
			vendor: "ajv",
			validate,
		},
	};
}

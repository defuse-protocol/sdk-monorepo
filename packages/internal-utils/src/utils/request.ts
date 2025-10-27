import { retry } from "@lifeomic/attempt";
import { HttpRequestError, TimeoutError } from "../errors/request";
import { isNetworkError } from "../errors/utils/isNetworkError";
import { toError } from "../errors/utils/toError";
import type { ILogger } from "../logger";
import { mergeAbortSignals } from "./abortSignal";
import { withTimeout } from "./promise/withTimeout";
import { requestShouldRetry } from "./requestShouldRetry";
import type { RetryOptions } from "./retry";

export type RequestErrorType = HttpRequestError | TimeoutError;

export async function request({
	// By default, do not repeat the request, since it might not be an idempotent call
	retryOptions = { maxAttempts: 1 },
	logger,
	...params
}: Parameters<typeof request_>[0] & {
	retryOptions?: RetryOptions;
	logger?: ILogger;
}): Promise<Response> {
	const overallStartTime = performance.now();
	let totalNetworkTime = 0;
	let attemptCount = 0;

	const response = await retry(
		async (ctx) => {
			attemptCount = ctx.attemptNum + 1;
			const attemptStartTime = performance.now();

			logger?.debug("Sending HTTP request", {
				url: params.url.toString(),
				method: params.fetchOptions?.method || "GET",
				body: JSON.stringify(params.body),
				attempt: ctx.attemptNum,
			});

			const response = await request_(params);

			const attemptDuration = performance.now() - attemptStartTime;
			totalNetworkTime += attemptDuration;

			logger?.debug("HTTP request attempt completed", {
				attempt: ctx.attemptNum,
				attemptDuration: Math.floor(attemptDuration),
				statusCode: response.status,
				success: response.ok,
				responseSize: response.headers.get("content-length"),
			});

			return response;
		},
		{
			...retryOptions,
			handleError: (err, context) => {
				logger?.error("HTTP request attempt failed", {
					attempt: context.attemptNum,
					errorMessage: toError(err).message,
				});

				if (
					!requestShouldRetry(err) ||
					params.fetchOptions?.signal?.reason === err
				) {
					context.abort();
				}
			},
		},
	);

	const overallDuration = performance.now() - overallStartTime;
	const retryOverhead = overallDuration - totalNetworkTime;

	logger?.[attemptCount > 1 ? "info" : "debug"]("HTTP request completed", {
		statusCode: response.status,
		success: response.ok,
		totalDuration: Math.floor(overallDuration),
		networkTime: Math.floor(totalNetworkTime),
		retryOverhead: Math.floor(retryOverhead),
		attempts: attemptCount,
		responseSize: response.headers.get("content-length"),
	});

	return response;
}

async function request_({
	url,
	body,
	timeout = 10_000,
	fetchOptions,
}: {
	url: string | URL;
	body?: unknown | undefined;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
}): Promise<Response> {
	const {
		headers: customHeaders,
		method,
		signal: signal_,
	} = fetchOptions ?? {};

	try {
		const headers = new Headers(customHeaders);
		headers.set("Content-Type", "application/json");
		const response = await withTimeout(
			({ signal }) => {
				return fetch(url, {
					...fetchOptions,
					method: method,
					headers,
					body: JSON.stringify(body),
					signal: mergeAbortSignals(
						[signal_, timeout > 0 ? signal : null].filter(
							Boolean,
						) as AbortSignal[],
					),
				});
			},
			{
				errorInstance: new TimeoutError({ body, url: url.toString() }),
				timeout,
				signal: true,
			},
		);

		if (!response.ok) {
			throw new HttpRequestError({
				body,
				details: response.statusText,
				headers: response.headers,
				status: response.status,
				url: url.toString(),
			});
		}

		return response;
	} catch (err: unknown) {
		if (err instanceof HttpRequestError) throw err;
		if (err instanceof TimeoutError) throw err;

		if (isNetworkError(err)) {
			throw new HttpRequestError({
				body,
				cause: err as Error,
				url: url.toString(),
			});
		}

		throw err;
	}
}

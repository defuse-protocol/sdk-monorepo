import { HttpRequestError, TimeoutError } from "../errors/request";
import { isNetworkError } from "../errors/utils/isNetworkError";
import { withTimeout } from "./promise/withTimeout";

export type RequestErrorType = HttpRequestError | TimeoutError;

export async function request({
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
	const { headers, method, signal: signal_ } = fetchOptions ?? {};

	try {
		const response = await withTimeout(
			({ signal }) => {
				return fetch(url, {
					...fetchOptions,
					method: method,
					headers: {
						"Content-Type": "application/json",
						...headers,
					},
					body: JSON.stringify(body),
					signal: signal_ || (timeout > 0 ? signal : null),
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

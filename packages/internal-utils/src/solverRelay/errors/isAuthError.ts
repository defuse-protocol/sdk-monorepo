import { HttpRequestError, RpcRequestError } from "../../errors/request";

export const AUTH_ERROR_CODE = 401;

export function isAuthError(err: unknown) {
	return (
		(err instanceof HttpRequestError && err.status === AUTH_ERROR_CODE) ||
		(err instanceof RpcRequestError && err.code === AUTH_ERROR_CODE)
	);
}

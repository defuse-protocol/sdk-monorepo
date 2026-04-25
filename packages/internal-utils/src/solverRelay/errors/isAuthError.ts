import { HttpRequestError, RpcRequestError } from "../../errors/request";

const AUTH_ERROR_CODE = 401;

export function isAuthError(err: unknown): boolean {
	return (
		(err instanceof HttpRequestError || err instanceof RpcRequestError) &&
		err.code === AUTH_ERROR_CODE
	);
}

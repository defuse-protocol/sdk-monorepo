import { BaseError } from "../../errors/base";
import { HttpRequestError, RpcRequestError } from "../../errors/request";

const AUTH_ERROR_CODE = 401;

export function isAuthError(err: unknown): boolean {
	if (err instanceof BaseError) {
		return err.walk((e) => isAuthErrorCode(e)) !== null;
	}
	return isAuthErrorCode(err);
}

function isAuthErrorCode(err: unknown): boolean {
	return (
		(err instanceof HttpRequestError || err instanceof RpcRequestError) &&
		err.code === AUTH_ERROR_CODE
	);
}

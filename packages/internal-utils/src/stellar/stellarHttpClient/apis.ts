import { HttpRequestError } from "../../errors";
import { StellarAccountNotFoundError } from "./errors";
import { horizonRequest } from "./runtime";
import {
	AccountResponseSchema,
	type AccountResponse,
	type RequestConfig,
} from "./types";

export async function getAccount(
	account: string,
	config: RequestConfig,
): Promise<AccountResponse> {
	try {
		return await horizonRequest(
			`accounts/${encodeURIComponent(account)}`,
			config,
			AccountResponseSchema,
		);
	} catch (error) {
		if (error instanceof HttpRequestError && error.status === 404) {
			throw new StellarAccountNotFoundError(account);
		}
		throw error;
	}
}

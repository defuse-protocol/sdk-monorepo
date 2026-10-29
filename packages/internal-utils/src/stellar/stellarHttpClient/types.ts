import * as v from "valibot";
import type { ILogger } from "../../logger";
import type { RetryOptions } from "../../utils/retry";

export type RequestConfig = {
	/** Horizon server URL */
	baseURL: string;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
	retryOptions?: RetryOptions;
	logger?: ILogger;
};

// --- Account ---

export const AccountBalanceSchema = v.object({
	/** `native`, `credit_alphanum4`, `credit_alphanum12` or `liquidity_pool_shares`. */
	asset_type: v.string(),
	/** Present for credit assets only. */
	asset_code: v.optional(v.string()),
	/** Present for credit assets only. Existence of the balance means the account has a trustline to this issuer. */
	asset_issuer: v.optional(v.string()),
	balance: v.string(),
});

export const AccountResponseSchema = v.object({
	account_id: v.string(),
	balances: v.array(AccountBalanceSchema),
});

export type AccountBalance = v.InferOutput<typeof AccountBalanceSchema>;
export type AccountResponse = v.InferOutput<typeof AccountResponseSchema>;

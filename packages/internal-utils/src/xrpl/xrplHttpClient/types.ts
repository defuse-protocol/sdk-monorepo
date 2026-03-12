import * as v from "valibot";
import type { ILogger } from "../../logger";
import type { RetryOptions } from "../../utils/retry";

export type RequestConfig = {
	baseURL: string;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
	retryOptions?: RetryOptions;
	logger?: ILogger;
};

// --- AccountInfo ---
const AccountFlagsSchema = v.object({
	/** Requires incoming payments to specify a Destination Tag. */
	requireDestinationTag: v.boolean(),
});

export const AccountInfoResponseSchema = v.object({
	result: v.object({
		account_data: v.object({
			Account: v.string(),
			Flags: v.optional(v.number()),
		}),
		/**
		 * A map of account flags parsed out.
		 * Only available for rippled nodes 1.11.0 and higher.
		 */
		account_flags: v.optional(AccountFlagsSchema),
		validated: v.optional(v.boolean()),
	}),
});

export type AccountInfoResponse = v.InferOutput<
	typeof AccountInfoResponseSchema
>;

// --- AccountLines ---

export const TrustLineSchema = v.object({
	/** The unique Address of the counterparty to this trust line. */
	account: v.string(),
	/** A Currency Code identifying what currency this trust line can hold. */
	currency: v.string(),
	/** The maximum amount of currency this account is willing to owe the peer. */
	limit: v.string(),
	/** The maximum amount of currency the peer is willing to owe this account. */
	limit_peer: v.string(),
	/** Current balance held against this line. Positive = account holds value, negative = account owes value. */
	balance: v.string(),
});

export const AccountLinesResponseSchema = v.object({
	result: v.object({
		lines: v.array(TrustLineSchema),
		marker: v.optional(v.unknown()),
	}),
});

export type TrustLine = v.InferOutput<typeof TrustLineSchema>;
export type AccountLinesResponse = v.InferOutput<
	typeof AccountLinesResponseSchema
>;

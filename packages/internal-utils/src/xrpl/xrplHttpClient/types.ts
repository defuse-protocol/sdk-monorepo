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
	/** Enables rippling on this account's trust lines by default. */
	defaultRipple: v.boolean(),
	/** Requires deposit authorization for incoming payments. */
	depositAuth: v.boolean(),
	/** Disables the master key for this account. */
	disableMasterKey: v.boolean(),
	/** Blocks incoming Checks from other accounts. */
	disallowIncomingCheck: v.boolean(),
	/** Blocks incoming NFToken offers from other accounts. */
	disallowIncomingNFTokenOffer: v.boolean(),
	/** Blocks incoming Payment Channels from other accounts. */
	disallowIncomingPayChan: v.boolean(),
	/** Blocks incoming trust lines from other accounts. */
	disallowIncomingTrustline: v.boolean(),
	/** Discourages incoming XRP payments to this account. */
	disallowIncomingXRP: v.boolean(),
	/** Freezes all tokens issued by this account. */
	globalFreeze: v.boolean(),
	/** Permanently gives up the ability to freeze tokens. */
	noFreeze: v.boolean(),
	/** The account has used its free SetRegularKey transaction. */
	passwordSpent: v.boolean(),
	/** Requires authorization for other accounts to hold tokens issued by this account. */
	requireAuthorization: v.boolean(),
	/** Requires incoming payments to specify a Destination Tag. */
	requireDestinationTag: v.boolean(),
	/** Allows clawback of tokens issued by this account. */
	allowTrustLineClawback: v.boolean(),
});

export const AccountInfoResponseSchema = v.object({
	result: v.object({
		account_data: v.object({
			Account: v.string(),
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
	/** The maximum amount of currency this account is willing to owe the peer. The limit field is a string-encoded decimal number in human-readable units (not drops/smallest units). */
	limit: v.string(),
	/** The maximum amount of currency the peer is willing to owe this account. The limit_peer field is a string-encoded decimal number in human-readable units (not drops/smallest units). */
	limit_peer: v.string(),
	/** Current balance held against this line. Positive = account holds value, negative = account owes value.  The balance field is a string-encoded decimal number in human-readable units (not drops/smallest units). */
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

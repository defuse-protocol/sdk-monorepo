import type { MultiPayload } from "@defuse-protocol/intents-sdk";

/**
 * Protocol types - snake_case format matching the relay protocol.
 */

/**
 * Special output types when solver cannot provide a quote
 */
export const QuoteOutputType = {
	NO_LIQUIDITY: "NO_LIQUIDITY",
	INSUFFICIENT_AMOUNT: "INSUFFICIENT_AMOUNT",
	UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
	DEADLINE_EXCEEDED: "DEADLINE_EXCEEDED",
	PRICE_DIFFERENCE_TOO_LARGE: "PRICE_DIFFERENCE_TOO_LARGE",
	SAME_TOKEN: "SAME_TOKEN",
	UNSUPPORTED_TOKENS: "UNSUPPORTED_TOKENS",
	MARKET_LIMIT: "MARKET_LIMIT",
	STALE_DATA: "STALE_DATA",
} as const;

export type QuoteOutputType =
	(typeof QuoteOutputType)[keyof typeof QuoteOutputType];

/** Incoming quote request from subscription */
export interface QuoteRequest {
	quote_id: string;
	defuse_asset_identifier_in: string;
	defuse_asset_identifier_out: string;
	exact_amount_in?: string;
	exact_amount_out?: string;
	min_deadline_ms: number;
	/** @deprecated use min_wait_ms/max_wait_ms */
	wait_ms?: number;
	min_wait_ms?: number;
	max_wait_ms?: number;
	protocol_fee_included?: boolean;
}

/** Arguments for requesting quotes via RPC */
export interface QuoteArgs {
	defuse_asset_identifier_in: string;
	defuse_asset_identifier_out: string;
	exact_amount_in?: string;
	exact_amount_out?: string;
	quote_id?: string;
	wait_ms?: number;
	min_wait_ms?: number;
	max_wait_ms?: number;
	min_deadline_ms?: number;
	protocol_fee_included?: boolean;
	trusted_metadata?: Record<string, unknown>;
}

/** Quote result from requestQuotes RPC */
export interface Quote {
	defuse_asset_identifier_in: string;
	defuse_asset_identifier_out: string;
	amount_in?: string;
	amount_out?: string;
	expiration_time: string;
	quote_hash: string;
	solver_id?: string;
}

/** Error from solver who couldn't provide a quote */
export interface QuoteError {
	type: string;
	min_amount?: string;
	solver_id?: string;
	time_to_liquidity_ms?: number;
	amount_in?: string;
	amount_out?: string;
}

/** Filters for quote subscription */
export interface QuoteFilters {
	chains?: string[];
	tokens_in?: string[];
	tokens_out?: string[];
}

/** Quote output with amount or rejection reason */
export interface QuoteOutput {
	amount_in?: string;
	amount_out?: string;
	min_amount?: string;
	time_to_liquidity_ms?: number;
	type?: string;
}

/** Response to a quote request */
export interface QuoteResponse {
	quote_id: string;
	quote_output: QuoteOutput;
	signed_data?: MultiPayload;
	other_quote_hashes?: string[];
	protocol_fee_included?: boolean;
	private_signed_data?: {
		shield: MultiPayload;
		swap: MultiPayload;
		recover: MultiPayload;
	};
}

/** Event types for quote execution notifications */
export const QuoteExecutionEventType = {
	SETTLE_SUCCESSFUL: "quote_settle_successful",
	SETTLE_FAILED: "quote_settle_failed",
	READY_TO_SETTLE: "quote_ready_to_settle",
} as const;

export type QuoteExecutionEventType =
	(typeof QuoteExecutionEventType)[keyof typeof QuoteExecutionEventType];

/** Quote execution notification */
export interface QuoteExecution {
	event_type: string;
	quote_hash: string;
	intent_hash: string;
	tx_hash: string;
}

/** Metadata attached to events - kept as snake_case per W3C standards */
export interface Metadata {
	traceparent?: string;
	partner_id?: string;
	quote_timestamp?: string;
}

/** Result from sendQuoteResponse - relay acknowledgment */
export interface QuoteResponseResult {
	accepted: boolean;
	error?: {
		code: number;
		message: string;
	};
}

/** Combined results from requestQuotes() */
export interface QuoteResults {
	quotes: Quote[];
	errors: QuoteError[];
}

import * as v from "valibot";

/**
 * Protocol schemas - validate snake_case protocol messages.
 * Uses looseObject to accept unknown fields for forward compatibility.
 */

export const QuoteRequestSchema = v.looseObject({
	quote_id: v.string(),
	defuse_asset_identifier_in: v.string(),
	defuse_asset_identifier_out: v.string(),
	exact_amount_in: v.optional(v.string()),
	exact_amount_out: v.optional(v.string()),
	min_deadline_ms: v.number(),
	wait_ms: v.optional(v.number()),
	min_wait_ms: v.optional(v.number()),
	max_wait_ms: v.optional(v.number()),
	protocol_fee_included: v.optional(v.boolean()),
});

export const QuoteExecutionSchema = v.looseObject({
	event_type: v.string(),
	quote_hash: v.string(),
	intent_hash: v.string(),
	tx_hash: v.string(),
});

export const MetadataSchema = v.looseObject({
	traceparent: v.optional(v.string()),
	partner_id: v.optional(v.string()),
	quote_timestamp: v.optional(v.string()),
});

export const QuoteSchema = v.looseObject({
	defuse_asset_identifier_in: v.string(),
	defuse_asset_identifier_out: v.string(),
	amount_in: v.optional(v.string()),
	amount_out: v.optional(v.string()),
	expiration_time: v.string(),
	quote_hash: v.string(),
	solver_id: v.optional(v.string()),
});

export const QuoteErrorSchema = v.looseObject({
	type: v.string(),
	min_amount: v.optional(v.string()),
	solver_id: v.optional(v.string()),
	time_to_liquidity_ms: v.optional(v.number()),
	amount_in: v.optional(v.string()),
	amount_out: v.optional(v.string()),
});

export const EventParamsSchema = v.looseObject({
	subscription: v.string(),
	data: v.unknown(),
	metadata: v.optional(MetadataSchema),
});

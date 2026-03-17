import * as v from "valibot";

/**
 * JSON-RPC Response Schema - for matching RPC responses
 */
export const JsonRpcResponseSchema = v.strictObject({
	jsonrpc: v.literal("2.0"),
	id: v.number(),
	result: v.optional(v.unknown()),
	error: v.optional(
		v.strictObject({
			code: v.number(),
			message: v.string(),
			data: v.optional(v.unknown()),
		}),
	),
});

/**
 * Generic JSON-RPC Notification Schema - for subscription events
 */
export const JsonRpcNotificationSchema = v.strictObject({
	jsonrpc: v.literal("2.0"),
	method: v.string(),
	params: v.optional(v.unknown()),
});

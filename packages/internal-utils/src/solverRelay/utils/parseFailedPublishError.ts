import { BaseError } from "../../errors/base";
import { assert } from "../../utils/assert";
import { serialize } from "../../utils/serialize";
import type * as solverRelayClient from "../solverRelayHttpClient";

type PublishErrorCode =
	| "SIGNATURE_EXPIRED"
	| "INTERNAL_ERROR"
	| "SIGNATURE_INVALID"
	| "NONCE_USED"
	| "INSUFFICIENT_BALANCE"
	| "PUBLIC_KEY_NOT_EXIST"
	| "UNKNOWN_ERROR"
	| "NETWORK_ERROR";

export type RelayPublishErrorType = RelayPublishError & {
	name: "RelayPublishError";
};
export class RelayPublishError extends BaseError {
	name = "RelayPublishError" as const;
	code: PublishErrorCode;

	constructor({
		reason,
		code,
		publishParams,
		cause,
	}: {
		reason: string;
		code: PublishErrorCode;
		publishParams:
			| Parameters<typeof solverRelayClient.publishIntents>[0]
			| Parameters<typeof solverRelayClient.publishIntent>[0];
		cause?: unknown;
	}) {
		super("Failed to publish intent.", {
			details: reason,
			metaMessages: [
				`Code: ${code}`,
				`Publish params: ${serialize(publishParams)}`,
			],
			name: "RelayPublishError",
			cause: cause,
		});
		this.code = code;
	}
}

export function toRelayPublishError(
	publishParams:
		| Parameters<typeof solverRelayClient.publishIntents>[0]
		| Parameters<typeof solverRelayClient.publishIntent>[0],
	response:
		| Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
		| Awaited<ReturnType<typeof solverRelayClient.publishIntent>>,
): RelayPublishErrorType {
	assert(response.status === "FAILED", "Expected response to be failed");

	return new RelayPublishError({
		reason: response.reason,
		code: parseFailedPublishReason(response),
		publishParams,
	});
}

function parseFailedPublishReason(
	response:
		| Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
		| Awaited<ReturnType<typeof solverRelayClient.publishIntent>>,
): PublishErrorCode {
	assert(response.status === "FAILED", "Expected response to be failed");

	if (
		response.reason === "expired" ||
		response.reason.includes("deadline has expired")
	) {
		return "SIGNATURE_EXPIRED";
	}

	if (response.reason === "internal") {
		return "INTERNAL_ERROR";
	}

	if (response.reason.includes("invalid signature")) {
		return "SIGNATURE_INVALID";
	}

	if (response.reason.includes("nonce was already used")) {
		return "NONCE_USED";
	}

	if (response.reason.includes("insufficient balance or overflow")) {
		return "INSUFFICIENT_BALANCE";
	}

	if (response.reason.includes("public key doesn't exist")) {
		return "PUBLIC_KEY_NOT_EXIST";
	}

	return "UNKNOWN_ERROR";
}

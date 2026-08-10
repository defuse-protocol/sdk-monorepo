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
	| "INVALID_SALT";

type PublishParams =
	| Parameters<typeof solverRelayClient.publishIntents>[0]
	| Parameters<typeof solverRelayClient.publishIntent>[0];

export type RelayPublishRejectedErrorType = RelayPublishRejectedError & {
	name: "RelayPublishRejectedError";
};

export type RelayPublishResultUnknownErrorType =
	RelayPublishResultUnknownError & {
		name: "RelayPublishResultUnknownError";
	};

export type RelayPublishErrorType =
	| RelayPublishRejectedErrorType
	| RelayPublishResultUnknownErrorType;

export abstract class RelayPublishError extends BaseError {
	publishParams: PublishParams;

	protected constructor({
		cause,
		metaMessages,
		name,
		publishParams,
		reason,
	}: {
		cause?: unknown;
		metaMessages?: string[];
		name: "RelayPublishRejectedError" | "RelayPublishResultUnknownError";
		publishParams: PublishParams;
		reason: string;
	}) {
		super("Failed to publish intent.", {
			details: reason,
			metaMessages: [
				...(metaMessages ?? []),
				`Publish params: ${serialize(publishParams)}`,
			],
			name,
			cause,
		});
		this.publishParams = publishParams;
	}
}

export class RelayPublishRejectedError extends RelayPublishError {
	name = "RelayPublishRejectedError" as const;
	code: PublishErrorCode;

	constructor({
		reason,
		code,
		publishParams,
	}: {
		reason: string;
		code: PublishErrorCode;
		publishParams: PublishParams;
	}) {
		super({
			reason,
			metaMessages: [`Code: ${code}`],
			name: "RelayPublishRejectedError",
			publishParams,
		});
		this.code = code;
	}
}

export class RelayPublishResultUnknownError extends RelayPublishError {
	name = "RelayPublishResultUnknownError" as const;

	constructor({
		reason,
		publishParams,
		cause,
	}: {
		reason: string;
		publishParams: PublishParams;
		cause?: unknown;
	}) {
		super({
			reason,
			name: "RelayPublishResultUnknownError",
			publishParams,
			cause,
		});
	}
}

export function toRelayPublishError(
	publishParams: PublishParams,
	response:
		| Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
		| Awaited<ReturnType<typeof solverRelayClient.publishIntent>>,
): RelayPublishRejectedErrorType {
	assert(response.status === "FAILED", "Expected response to be failed");

	return new RelayPublishRejectedError({
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

	if (response.reason.includes("invalid salt")) {
		return "INVALID_SALT";
	}

	return "UNKNOWN_ERROR";
}

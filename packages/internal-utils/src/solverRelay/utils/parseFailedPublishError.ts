import { assert } from "../../utils/assert";
import type * as solverRelayClient from "../solverRelayHttpClient";

export type ParsedPublishErrors =
	| {
			reason:
				| "RELAY_PUBLISH_SIGNATURE_EXPIRED"
				| "RELAY_PUBLISH_INTERNAL_ERROR"
				| "RELAY_PUBLISH_SIGNATURE_INVALID"
				| "RELAY_PUBLISH_NONCE_USED"
				| "RELAY_PUBLISH_INSUFFICIENT_BALANCE"
				| "RELAY_PUBLISH_PUBLIC_NOT_EXIST";
	  }
	| {
			reason: "RELAY_PUBLISH_UNKNOWN_ERROR";
			serverReason: string;
	  };

export function parseFailedPublishError(
	response:
		| Awaited<ReturnType<typeof solverRelayClient.publishIntents>>
		| Awaited<ReturnType<typeof solverRelayClient.publishIntent>>,
): ParsedPublishErrors {
	assert(response.status === "FAILED", "Expected response to be failed");

	if (
		response.reason === "expired" ||
		response.reason.includes("deadline has expired")
	) {
		return { reason: "RELAY_PUBLISH_SIGNATURE_EXPIRED" };
	}

	if (response.reason === "internal") {
		return { reason: "RELAY_PUBLISH_INTERNAL_ERROR" };
	}

	if (response.reason.includes("invalid signature")) {
		return { reason: "RELAY_PUBLISH_SIGNATURE_INVALID" };
	}

	if (response.reason.includes("nonce was already used")) {
		return { reason: "RELAY_PUBLISH_NONCE_USED" };
	}

	if (response.reason.includes("insufficient balance or overflow")) {
		return { reason: "RELAY_PUBLISH_INSUFFICIENT_BALANCE" };
	}

	if (response.reason.includes("public key doesn't exist")) {
		return { reason: "RELAY_PUBLISH_PUBLIC_NOT_EXIST" };
	}

	return {
		reason: "RELAY_PUBLISH_UNKNOWN_ERROR",
		serverReason: response.reason,
	};
}

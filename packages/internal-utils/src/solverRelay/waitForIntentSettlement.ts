import { retry } from "@lifeomic/attempt";
import { BaseError } from "../errors/base";
import { HttpRequestError } from "../errors/request";
import { wait } from "../utils/wait";
import * as solverRelayClient from "./solverRelayHttpClient";
import type * as types from "./solverRelayHttpClient/types";

export type IntentSettlementResult = Awaited<
	ReturnType<typeof waitForIntentSettlement>
>;

export async function waitForIntentSettlement({
	intentHash,
	signal,
	baseURL,
}: {
	intentHash: string;
	signal: AbortSignal;
	baseURL?: string;
}) {
	let attempts = 0;
	const MAX_INVALID_ATTEMPTS = 3; // ~600 ms of waiting

	let lastSeenResult: types.GetStatusResponse["result"] | null = null;
	let txHash: string | null = null;

	while (true) {
		signal.throwIfAborted();

		const res = await retry(
			() =>
				solverRelayClient.getStatus({ intent_hash: intentHash }, { baseURL }),
			{
				delay: 1000,
				factor: 1.5,
				maxAttempts: Number.MAX_SAFE_INTEGER,
				jitter: true,
				handleError: (err, context) => {
					if (
						err instanceof BaseError &&
						err.walk((err) => err instanceof HttpRequestError)
					) {
						return;
					}

					context.abort();
				},
			},
		);

		const status = res.status;
		switch (status) {
			case "PENDING":
				// Do nothing, just wait
				break;

			case "TX_BROADCASTED":
				txHash = res.data.hash;
				break;

			case "SETTLED":
				return {
					status: "SETTLED" as const,
					txHash: res.data.hash,
					intentHash: res.intent_hash,
				};

			case "NOT_FOUND_OR_NOT_VALID": {
				if (
					// If previous status differs, we're sure new result is final
					(lastSeenResult != null && lastSeenResult.status !== res.status) ||
					// If we've seen only NOT_VALID and keep getting it then we should abort
					MAX_INVALID_ATTEMPTS <= ++attempts
				) {
					return {
						status: "NOT_FOUND_OR_NOT_VALID" as const,
						txHash: txHash,
						intentHash: res.intent_hash,
					};
				}
				break;
			}

			default:
				status satisfies never;
		}

		lastSeenResult = res;

		// Wait a bit before polling again
		await wait(200);
	}
}

import { retry } from "@lifeomic/attempt";
import { Err, Ok, type Result } from "@thames/monads";
import { logger } from "../logger";
import * as solverRelayClient from "./solverRelayHttpClient";
import {
	type ParsedPublishErrors,
	parseFailedPublishError,
} from "./utils/parseFailedPublishError";

export async function publishIntents(
	...args: Parameters<typeof solverRelayClient.publishIntents>
): Promise<Result<PublishIntentsOk, PublishIntentsErr>> {
	const [params, requestConfig] = args;
	return retry(
		() =>
			solverRelayClient.publishIntents(params, {
				timeout: 30000,
				...requestConfig,
			}),
		{
			delay: 1000,
			factor: 1.5,
			maxAttempts: 7,
			jitter: true,
			minDelay: 1000,
		},
	)
		.then(parsePublishIntentsResponse, (err) => {
			logger.error(new Error("Failed to publish intents", { cause: err }));
			return Err<PublishIntentsOk, PublishIntentsErr>({
				reason: "RELAY_PUBLISH_NETWORK_ERROR",
			});
		})
		.then((result) => {
			if (result.isErr()) {
				const err = result.unwrapErr();
				if (err.reason === "RELAY_PUBLISH_UNKNOWN_ERROR") {
					logger.error(err.serverReason);
				}
			}
			return result;
		});
}

export type PublishIntentsOk = string[];
export type PublishIntentsErr =
	| ParsedPublishErrors
	| { reason: "RELAY_PUBLISH_NETWORK_ERROR" };

function parsePublishIntentsResponse(
	response: Awaited<ReturnType<typeof solverRelayClient.publishIntents>>,
): Result<PublishIntentsOk, PublishIntentsErr> {
	if (response.status === "OK") {
		return Ok(response.intent_hashes);
	}

	if (response.reason === "already processed") {
		return Ok(response.intent_hashes);
	}

	return Err(parseFailedPublishError(response));
}

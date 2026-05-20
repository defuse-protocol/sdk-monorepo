import { Err, Ok, type Result } from "@thames/monads";
import * as solverRelayClient from "./solverRelayHttpClient";
import {
	RelayPublishResultUnknownError,
	type RelayPublishErrorType,
	toRelayPublishError,
} from "./utils/parseFailedPublishError";

export async function publishIntents(
	...args: Parameters<typeof solverRelayClient.publishIntents>
): Promise<Result<PublishIntentsReturnType, PublishIntentsErrorType>> {
	const [params, requestConfig] = args;
	return solverRelayClient
		.publishIntents(params, {
			timeout: 30000,
			...requestConfig,
			retryOptions: {
				delay: 1000,
				factor: 1.5,
				maxAttempts: 7,
				jitter: true,
				minDelay: 1000,
			},
		})
		.then(
			(response) => {
				return parsePublishIntentsResponse(params, response);
			},
			(err) => {
				const publishError = new RelayPublishResultUnknownError({
					reason:
						"Failed to receive a usable publish response from the relay. Publish result is unknown.",
					publishParams: params,
					cause: err,
				});
				return Err<PublishIntentsReturnType, PublishIntentsErrorType>(
					publishError,
				);
			},
		)
		.then((result) => {
			if (result.isErr()) {
				const err = result.unwrapErr();
				args[1]?.logger?.error(err);
			}
			return result;
		});
}

export type PublishIntentsReturnType = string[];
export type PublishIntentsErrorType = RelayPublishErrorType;

function parsePublishIntentsResponse(
	publishParams: Parameters<typeof solverRelayClient.publishIntents>[0],
	response: Awaited<ReturnType<typeof solverRelayClient.publishIntents>>,
): Result<PublishIntentsReturnType, PublishIntentsErrorType> {
	if (response.status === "OK") {
		return Ok(response.intent_hashes);
	}

	if (response.reason === "already processed") {
		return Ok(response.intent_hashes);
	}

	return Err(toRelayPublishError(publishParams, response));
}

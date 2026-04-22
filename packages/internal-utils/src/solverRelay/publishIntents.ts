import { Err, Ok, type Result } from "@thames/monads";
import { RpcRequestError } from "../errors/request";
import * as solverRelayClient from "./solverRelayHttpClient";
import {
	RelayPublishError,
	type RelayPublishErrorType,
	toRelayPublishError,
} from "./utils/parseFailedPublishError";

const DEFAULT_REQUEST_FAIL_ERROR_MESSAGE =
	"Error occurred during sending a request";
const SOLVER_RELAY_AUTH_ERROR_MESSAGE =
	"Solver relay rejected request. Pass solverRelayApiKey via x-api-key header.";
const SOLVER_RELAY_UNAUTHORIZED_RPC_CODE = -32001;

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
				const authRejected =
					err instanceof RpcRequestError &&
					err.code === SOLVER_RELAY_UNAUTHORIZED_RPC_CODE;

				const errorReason = authRejected
					? SOLVER_RELAY_AUTH_ERROR_MESSAGE
					: DEFAULT_REQUEST_FAIL_ERROR_MESSAGE;

				const publishError = new RelayPublishError({
					reason: errorReason,
					code: authRejected ? "AUTH_CONFIG_ERROR" : "NETWORK_ERROR",
					publishParams: params,
					cause: authRejected ? undefined : err,
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

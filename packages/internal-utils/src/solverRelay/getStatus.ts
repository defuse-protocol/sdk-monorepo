import type { AssertionErrorType } from "../errors";
import { assert } from "../utils";
import * as solverRelayClient from "./solverRelayHttpClient";

export type GetStatusReturnType =
	| {
			status: "PENDING" | "NOT_FOUND_OR_NOT_VALID";
			intentHash: string;
	  }
	| {
			status: "TX_BROADCASTED" | "SETTLED";
			intentHash: string;
			txHash: string;
	  };

export type GetStatusErrorType =
	| solverRelayClient.JSONRPCErrorType
	| AssertionErrorType;

export async function getStatus(
	...args: Parameters<typeof solverRelayClient.getStatus>
): Promise<GetStatusReturnType> {
	return solverRelayClient.getStatus(...args).then((response) => {
		const status = response.status;
		switch (status) {
			case "SETTLED":
			case "TX_BROADCASTED":
				return {
					status,
					intentHash: response.intent_hash,
					txHash: response.data.hash,
				};
			case "PENDING":
			case "NOT_FOUND_OR_NOT_VALID":
				return {
					status,
					intentHash: response.intent_hash,
				};
			default:
				status satisfies never;
				assert(false, `Unexpected intent status = ${status}`);
		}
	});
}

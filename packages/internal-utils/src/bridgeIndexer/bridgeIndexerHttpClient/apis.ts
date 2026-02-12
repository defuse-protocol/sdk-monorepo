import { handleResponse } from "../../utils/handleResponse";
import { request } from "../../utils/request";
import {
	BridgeIndexerResponseSchema,
	type BridgeIndexerResponse,
	type RequestConfig,
} from "./types";

export async function withdrawalsByNearTxHash(
	nearTxHash: string,
	config: RequestConfig,
): Promise<BridgeIndexerResponse> {
	const url = new URL("/api/v1/withdrawals", config.envConfig.bridgeIndexerUrl);
	url.searchParams.set("near_trx", nearTxHash);

	const response = await request({
		url,
		...config,
		fetchOptions: {
			...config.fetchOptions,
			method: "GET",
		},
	});

	return handleResponse(response, undefined, BridgeIndexerResponseSchema);
}

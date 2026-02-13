import { httpRequest } from "./runtime";
import {
	BridgeIndexerResponseSchema,
	type BridgeIndexerResponse,
	type RequestConfig,
} from "./types";

export async function withdrawalsByNearTxHash(
	nearTxHash: string,
	config?: RequestConfig,
): Promise<BridgeIndexerResponse> {
	return httpRequest(
		"/api/v1/withdrawals",
		{ near_trx: nearTxHash },
		config,
		BridgeIndexerResponseSchema,
	);
}

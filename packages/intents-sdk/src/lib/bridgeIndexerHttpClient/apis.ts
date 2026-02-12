import { request } from "@defuse-protocol/internal-utils";
import {
	BridgeIndexerResponseSchema,
	type BridgeIndexerResponse,
	type RequestConfig,
} from "./types";
import * as v from "valibot";

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

	const json = await response.json();

	return v.parse(BridgeIndexerResponseSchema, json);
}

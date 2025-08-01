import { config as globalConfig } from "../../config";
import { request } from "../../utils/request";
import type * as types from "./types";

export async function fee(
	params: {
		token: types.OmniAddress;
		sender: types.OmniAddress;
		recipient: types.OmniAddress;
	},
	config: types.RequestConfig = {},
): Promise<types.OmniTransferFeeResponse> {
	const baseURL = config.baseURL ?? globalConfig.env.omniBridgeRelayerBaseUrl;
	const response = await request({
		url: `${baseURL}/api/v1/transfer-fee?token=${params.token}&sender=${params.sender}&recipient=${params.recipient}`,
		fetchOptions: {
			method: "GET",
		},
	});

	return response.json();
}

export async function transfer(
	params: {
		hash: string;
	},
	config: types.RequestConfig = {},
): Promise<any[]> {
	const baseURL = config.baseURL ?? globalConfig.env.omniBridgeRelayerBaseUrl;
	const response = await request({
		url: `${baseURL}/api/v1/transfers/?transaction_id=${params.hash}&offset=0&limit=1`,
		fetchOptions: {
			method: "GET",
		},
	});

	const data = await response.json();
	return data[0]
}

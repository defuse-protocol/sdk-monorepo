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

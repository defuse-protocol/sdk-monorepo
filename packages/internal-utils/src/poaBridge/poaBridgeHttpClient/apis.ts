import { config as globalConfig } from "../../config";
import { request } from "../../utils/request";
import { jsonRPCRequest } from "./runtime";
import type * as types from "./types";

export async function getSupportedTokens(
	params: types.GetSupportedTokensRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.GetSupportedTokensResponse["result"]> {
	const result = await jsonRPCRequest<types.GetSupportedTokensRequest>(
		"supported_tokens",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

export async function getDepositAddress(
	params: types.GetDepositAddressRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.GetDepositAddressResponse["result"]> {
	const result = await jsonRPCRequest<types.GetDepositAddressRequest>(
		"deposit_address",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

export async function getDepositStatus(
	params: types.GetDepositStatusRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.GetDepositStatusResponse["result"]> {
	const result = await jsonRPCRequest<types.GetDepositStatusRequest>(
		"recent_deposits",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

export async function getWithdrawalStatus(
	params: types.WithdrawalStatusRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.WithdrawalStatusResponseOk["result"]> {
	const result = await jsonRPCRequest<types.WithdrawalStatusRequest>(
		"withdrawal_status",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

export async function hotOmniWithdraw(
	params: types.HotOmniWithdrawRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.HotOmniWithdrawResponse["result"]> {
	const result = await jsonRPCRequest<types.HotOmniWithdrawRequest>(
		"hot_omni_withdraw",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

export async function getTokenBalancesRequest(
	addresses: string[],
	config: types.RequestConfig = {},
): Promise<types.BridgeBalanceResponse> {
	// Use config.baseURL if provided, otherwise fall back to global config
	const baseURL = config.baseURL ?? globalConfig.env.poaBridgeBaseURL;
	const params = addresses.map((address) => `addresses[]=${address}`).join("&");
	const response = await request({
		url: `${baseURL}/console/tokenBalances?${params}`,
		fetchOptions: {
			method: "GET",
		},
	});

	return response.json();
}

export async function getWithdrawalEstimate(
	params: types.GetWithdrawalEstimateRequest["params"][0],
	config: types.RequestConfig = {},
): Promise<types.WithdrawalEstimateResponse> {
	const result = await jsonRPCRequest<types.GetWithdrawalEstimateRequest>(
		"withdrawal_estimate",
		params,
		config,
	);
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	return result as any;
}

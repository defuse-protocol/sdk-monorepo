import type { RpcRequestError } from "../../errors/request";
import type { BaseTokenInfo } from "../../types/base";
import type { RequestErrorType } from "../../utils/request";
import type { BlockchainEnum } from "../constants/blockchains";

export type RequestConfig = {
	requestId?: string | undefined;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
};

export type JSONRPCRequest<Method, Params> = {
	id: string;
	jsonrpc: "2.0";
	method: Method;
	params: Params[];
};

export type JSONRPCResponse<Result> = {
	id: string;
	jsonrpc: "2.0";
	result: Result;
};

export type JSONRPCErrorType = RequestErrorType | RpcRequestError;

export type GetSupportedTokensRequest = JSONRPCRequest<
	"supported_tokens",
	{
		chains?: string[];
	}
>;

export type GetSupportedTokensResponse = JSONRPCResponse<{
	tokens: {
		defuse_asset_identifier: string;
		decimals: number;
		asset_name: string;
		near_token_id: string;
		min_deposit_amount: string;
		min_withdrawal_amount: string;
		withdrawal_fee: string;
	}[];
}>;

export type GetDepositAddressRequest = JSONRPCRequest<
	"deposit_address",
	{
		account_id: string;
		/** Chain is joined blockchain and network (e.g. eth:8453) */
		chain: string;
	}
>;

export type GetDepositAddressResponse = JSONRPCResponse<{
	address: string;
	chain: string;
}>;

export type DepositStatus = {
	tx_hash: string;
	chain: string;
	defuse_asset_identifier: string;
	near_token_id: string;
	decimals: number;
	amount: number;
	account_id: string;
	address: string;
	status: "COMPLETED" | "PENDING" | "FAILED";
};

export type GetDepositStatusRequest = JSONRPCRequest<
	"recent_deposits",
	{
		account_id: string;
		chain?: string;
	}
>;

export type GetDepositStatusResponse = JSONRPCResponse<{
	deposits: DepositStatus[];
}>;

export type WithdrawalStatusRequest = JSONRPCRequest<
	"withdrawal_status",
	{
		withdrawal_hash: string;
	}
>;

export type WithdrawalStatusResponseOk = JSONRPCResponse<{
	withdrawals: {
		status: "COMPLETED" | "PENDING";
		data: {
			tx_hash: string;
			transfer_tx_hash: string | null;
			chain: string;
			defuse_asset_identifier: string;
			near_token_id: string;
			decimals: number;
			amount: number;
			account_id: string; // initiator
			address: string; // ??
			created: string; // ISO date
		};
	}[];
}>;

export type HotOmniWithdrawRequest = JSONRPCRequest<
	"hot_omni_withdraw",
	{
		account_id: string; // intent user
		tx_hash: string; // near tx hash
		receiver: string; // address destination chain
		chain_id: string; // special HOT Network ID
	}
>;

export type HotOmniWithdrawResponse = JSONRPCResponse<
	{
		status: "COMPLETED" | "PENDING";
		data: {
			transfer_tx_hash: string | null;
		};
	}[]
>;

export type TokenBalances = {
	symbol: string;
	address: string;
	nearAddress: string;
	decimals: number;
	totalSupply: string;
	vaultBalance: string;
	coldWalletBalance: string;
	balanceOnDefuse: string;
};

export type BridgeBalanceResponse = TokenBalances[];

export type GetWithdrawalEstimateRequest = JSONRPCRequest<
	"withdrawal_estimate",
	{
		token: string;
		address: string;
		chain: BlockchainEnum;
	}
>;
export type WithdrawalEstimateResponse = {
	token: BaseTokenInfo;
	tokenAddress: string;
	userAddress: string;
	withdrawalFee: string;
	withdrawalFeeDecimals: number;
};

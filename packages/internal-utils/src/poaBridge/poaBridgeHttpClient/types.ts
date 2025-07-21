import type { RpcRequestError } from "../../errors/request";
import type { ILogger } from "../../logger";
import type { BaseTokenInfo } from "../../types/base";
import type { RequestErrorType } from "../../utils/request";
import type { RetryOptions } from "../../utils/retry";
import type { BlockchainEnum } from "../constants/blockchains";

export type RequestConfig = {
	requestId?: string | undefined;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
	baseURL?: string | undefined;
	retryOptions?: RetryOptions;
	logger?: ILogger;
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
		/**
		 * Raw asset id.
		 * Example: "nep245:v2_1.omni.hot.tg:1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR"
		 */
		intents_token_id: string;
		/**
		 * Token standard extracted from intents_token_id (the part before the first colon).
		 * In most cases it is either "nep245" or "nep141"
		 */
		standard: string;
		/**
		 * Contract ID extracted from intents_token_id (the part between the first and second colon).
		 * Example: "v2_1.omni.hot.tg"
		 */
		near_token_id: string;
		/**
		 * Token ID extracted from intents_token_id (the part after the second colon).
		 * Only present for "nep245" standard tokens.
		 * Example: "1117_3tsdfyziyc7EJbP2aULWSKU4toBaAcN4FdTgfm5W1mC4ouR"
		 */
		multi_token_id?: string;
		/**
		 * Symbol
		 */
		asset_name: string;
		decimals: number;
		min_deposit_amount: string;
		min_withdrawal_amount: string;
		withdrawal_fee: string;
		/**
		 * Internal POA Bridge identifier.
		 * @deprecated This identifier is for internal use only and should not be used in client code.
		 * @internal
		 */
		defuse_asset_identifier: string;
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

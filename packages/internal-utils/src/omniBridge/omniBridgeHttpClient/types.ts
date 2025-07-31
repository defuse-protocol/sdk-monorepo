import type { ILogger } from "../../logger";
import type { RetryOptions } from "../../utils/retry";

export type OmniAddress =
	| `eth:${string}` // Ethereum addresses
	| `near:${string}` // NEAR accounts
	| `sol:${string}` // Solana public keys
	| `arb:${string}` // Arbitrum addresses
	| `base:${string}`; // Base addresses
export type Chain = "Eth" | "Near" | "Sol" | "Arb" | "Base";
export type RequestConfig = {
	requestId?: string | undefined;
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
	baseURL?: string | undefined;
	retryOptions?: RetryOptions;
	logger?: ILogger;
};

export type OmniTransferFeeResponse = {
	native_token_fee: string;
	transferred_token_fee: string;
	usd_fee: number;
};

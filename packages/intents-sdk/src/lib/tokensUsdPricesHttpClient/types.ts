import type { NearIntentsEnv } from "@defuse-protocol/internal-utils";
export type { RequestErrorType } from "@defuse-protocol/internal-utils";

export type RequestConfig = {
	timeout?: number | undefined;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
	env: NearIntentsEnv;
};

export type TokenUsdPriceInfo = {
	defuse_asset_id: string;
	decimals: number;
	blockchain: string;
	symbol: string;
	price: number;
	price_updated_at: string;
	contract_address: string;
};

export type TokensUsdPricesPayload = {
	items: TokenUsdPriceInfo[];
	skip: number;
	take: number;
	total: number;
};

import type { EnvConfig } from "@defuse-protocol/internal-utils";
import * as v from "valibot";

export type RequestConfig = {
	timeout?: number | undefined;
	envConfig: EnvConfig;
	fetchOptions?: Omit<RequestInit, "body"> | undefined;
};

const WithdrawalSchema = v.object({
	hash: v.nullable(v.string()),
	nonce: v.string(),
	chain_id: v.nullable(v.number()),
	withdraw_asset: v.nullable(v.string()),
	withdraw_token: v.nullable(v.string()),
	withdraw_amount: v.nullable(v.string()),
	receiver_address: v.nullable(v.string()),
	signature: v.nullable(v.string()),
	near_tx_time: v.nullable(v.string()),
	near_tx_block: v.nullable(v.string()),
	destination_chain_block: v.nullable(v.string()),
});

export const BridgeIndexerResponseSchema = v.object({
	near_trx: v.nullable(v.string()),
	withdrawals: v.array(WithdrawalSchema),
});

export type BridgeIndexerResponse = v.InferOutput<
	typeof BridgeIndexerResponseSchema
>;

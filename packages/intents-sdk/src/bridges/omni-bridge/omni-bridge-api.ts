import { request } from "@defuse-protocol/internal-utils";
import { API_BASE } from "./omni-bridge-constants";
import type { OmniAddress } from "./omni-bridge-types";
import * as v from "valibot";

const ApiFeeResponseSchema = v.object({
	native_token_fee: v.string(),
	gas_fee: v.optional(v.nullable(v.string())),
	protocol_fee: v.optional(v.nullable(v.string())),
	usd_fee: v.number(),
	transferred_token_fee: v.optional(v.nullable(v.string())),
	min_amount: v.optional(v.nullable(v.string())),
	insufficient_utxo: v.optional(v.boolean()),
});

export type ApiFeeResponse = v.InferOutput<typeof ApiFeeResponseSchema>;

export async function getFee(
	sender: OmniAddress,
	recipient: OmniAddress,
	tokenAddress: OmniAddress,
	amount: string | bigint,
): Promise<ApiFeeResponse> {
	const url = new URL("/api/v3/transfer-fee", API_BASE);
	url.searchParams.append("sender", sender);
	url.searchParams.append("recipient", recipient);
	url.searchParams.append("token", tokenAddress);
	url.searchParams.append(
		"amount",
		typeof amount === "bigint" ? amount.toString() : amount,
	);

	const response = await request({
		url,
		fetchOptions: {
			method: "GET",
		},
		timeout: typeof window !== "undefined" ? 10_000 : 3000,
	});
	const data = await response.json();
	return v.parse(ApiFeeResponseSchema, data);
}

// ----------------------------------------------
// Helper: integer + min(0)
// ----------------------------------------------
const intMin0 = v.pipe(v.number(), v.integer(), v.minValue(0));

// ----------------------------------------------
// NearReceiptTransactionSchema
// ----------------------------------------------
export const NearReceiptTransactionSchema = v.object({
	block_height: intMin0,
	block_timestamp_seconds: intMin0,
	transaction_hash: v.string(),
});

// ----------------------------------------------
// EVMLogTransactionSchema
// ----------------------------------------------
export const EVMLogTransactionSchema = v.object({
	block_height: intMin0,
	block_timestamp_seconds: intMin0,
	transaction_hash: v.string(),
});

// ----------------------------------------------
// SolanaTransactionSchema (all optional)
// ----------------------------------------------
export const SolanaTransactionSchema = v.object({
	slot: v.optional(intMin0),
	block_timestamp_seconds: v.optional(intMin0),
	signature: v.optional(v.string()),
});

// ----------------------------------------------
// UtxoLogTransactionSchema
// ----------------------------------------------
export const UtxoLogTransactionSchema = v.object({
	transaction_hash: v.string(),
	block_height: v.nullable(intMin0),
	block_time: v.nullable(intMin0),
});

// ----------------------------------------------
// UtxoTransferSchema
// ----------------------------------------------
export const UtxoTransferSchema = v.object({
	chain: v.string(),
	amount: v.string(),
	recipient: v.string(),
	relayer_fee: v.string(),
	protocol_fee: v.string(),
	relayer_account_id: v.string(),
	sender: v.union([v.string(), v.nullable(v.string())]),
	btc_pending_id: v.optional(v.string()),
});

// ----------------------------------------------
// Chain enum
// ----------------------------------------------
export const ChainSchema = v.picklist([
	"Eth",
	"Near",
	"Sol",
	"Arb",
	"Base",
	"Bnb",
	"Btc",
]);

// ----------------------------------------------
// TransactionSchema (must have exactly 1 field)
// ----------------------------------------------
export const TransactionSchema = v.pipe(
	v.object({
		NearReceipt: v.optional(NearReceiptTransactionSchema),
		EVMLog: v.optional(EVMLogTransactionSchema),
		Solana: v.optional(SolanaTransactionSchema),
		UtxoLog: v.optional(UtxoLogTransactionSchema),
	}),
	v.check((data) => {
		const defined = [
			data.NearReceipt,
			data.EVMLog,
			data.Solana,
			data.UtxoLog,
		].filter((x) => x !== undefined);

		return defined.length === 1;
	}, "Exactly one transaction type must be present"),
);

// ----------------------------------------------
// TransferMessageSchema
// ----------------------------------------------
export const TransferMessageSchema = v.object({
	token: v.string(),
	amount: v.string(),
	sender: v.string(),
	recipient: v.string(),
	fee: v.object({
		fee: v.string(),
		native_fee: v.string(),
	}),
	msg: v.nullable(v.string()),
});

// ----------------------------------------------
// TransferSchema
// ----------------------------------------------
export const TransferSchema = v.object({
	id: v.nullable(
		v.optional(
			v.object({
				origin_chain: ChainSchema,
				kind: v.union([
					v.object({
						Nonce: v.number(),
					}),
					v.object({
						Utxo: v.object({
							tx_hash: v.string(),
							vout: v.number(),
						}),
					}),
				]),
			}),
		),
	),

	initialized: v.union([v.nullable(TransactionSchema), TransactionSchema]),
	signed: v.union([v.nullable(TransactionSchema), TransactionSchema]),
	fast_finalised_on_near: v.union([
		v.nullable(TransactionSchema),
		TransactionSchema,
	]),
	finalised_on_near: v.union([
		v.nullable(TransactionSchema),
		TransactionSchema,
	]),
	fast_finalised: v.union([v.nullable(TransactionSchema), TransactionSchema]),
	finalised: v.union([v.nullable(TransactionSchema), TransactionSchema]),
	claimed: v.union([v.nullable(TransactionSchema), TransactionSchema]),

	transfer_message: v.union([
		v.nullable(TransferMessageSchema),
		TransferMessageSchema,
	]),

	updated_fee: v.array(TransactionSchema),

	utxo_transfer: v.union([v.nullable(UtxoTransferSchema), UtxoTransferSchema]),
});

// ----------------------------------------------
// Inferred Types
// ----------------------------------------------
export type Transfer = v.InferOutput<typeof TransferSchema>;

export async function getTransfer(
	transactionHash: string,
): Promise<Transfer[]> {
	const url = new URL("/api/v3/transfers/transfer", API_BASE);
	url.searchParams.append("transaction_hash", transactionHash);

	const response = await request({
		url,
		fetchOptions: {
			method: "GET",
		},
	});
	const data = await response.json();
	return v.parse(v.array(TransferSchema), data);
}

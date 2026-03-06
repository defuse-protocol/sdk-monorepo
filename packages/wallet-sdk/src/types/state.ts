import { BorshSchema } from "borsher";

export const globalContractIdSchema = BorshSchema.Enum({
	CodeHash: BorshSchema.Array(BorshSchema.u8, 32),
	AccountId: BorshSchema.String,
});

export const stateInitV1Schema = BorshSchema.Struct({
	code: globalContractIdSchema,
	// Rust side uses BTreeMap. Borsher only has HashMap (same wire format),
	// so entries must be sorted by key before serialization.
	data: BorshSchema.HashMap(
		BorshSchema.Vec(BorshSchema.u8),
		BorshSchema.Vec(BorshSchema.u8),
	),
});

export const stateInitSchema = BorshSchema.Enum({
	V1: stateInitV1Schema,
});

export type GlobalContractId = { hash: number[] } | { account_id: string };

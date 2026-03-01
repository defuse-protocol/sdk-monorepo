import { BorshSchema } from "borsher";

export const DEFAULT_WALLET_ID = 0;
export const STATE_KEY: number[] = [];

export const ED25519_KEY_LENGTH = 32;
export const P256_COMPRESSED_KEY_LENGTH = 33;

export const walletStateSchema = (keyLength: number) =>
	BorshSchema.Struct({
		signature_enabled: BorshSchema.bool,
		seqno: BorshSchema.u32,
		wallet_id: BorshSchema.u32,
		public_key: BorshSchema.Array(BorshSchema.u8, keyLength),
		extensions: BorshSchema.Vec(BorshSchema.String),
	});

export const getKeyLength = (publicKey: Uint8Array): number => {
	if (publicKey.length === ED25519_KEY_LENGTH) return ED25519_KEY_LENGTH;
	if (publicKey.length === P256_COMPRESSED_KEY_LENGTH)
		return P256_COMPRESSED_KEY_LENGTH;
	throw new Error(
		`Unsupported public key length: ${publicKey.length}. Expected ${ED25519_KEY_LENGTH} (Ed25519) or ${P256_COMPRESSED_KEY_LENGTH} (P-256 compressed).`,
	);
};

export const globalContractIdSchema = BorshSchema.Enum({
	CodeHash: BorshSchema.Array(BorshSchema.u8, 32),
	AccountId: BorshSchema.String,
});

export const stateInitV1Schema = BorshSchema.Struct({
	code: globalContractIdSchema,
	data: BorshSchema.HashMap(
		BorshSchema.Vec(BorshSchema.u8),
		BorshSchema.Vec(BorshSchema.u8),
	),
});

export const stateInitSchema = BorshSchema.Enum({
	V1: stateInitV1Schema,
});

export type WalletGlobalContractId =
	| { CodeHash: number[] }
	| { AccountId: string };

export type WalletState = {
	signature_enabled: boolean;
	seqno: number;
	wallet_id: number;
	public_key: Uint8Array;
	extensions: string[];
};

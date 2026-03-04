import {BorshSchema} from "borsher";

export const DEFAULT_WALLET_ID = 0;

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
    // Rust side uses BTreeMap. Borsher only has HashMap (same wire format),
    // so entries must be sorted by key before serialization.
    data: BorshSchema.HashMap(
        BorshSchema.Vec(BorshSchema.u8),
        BorshSchema.Vec(BorshSchema.u8),
    ),
});

/** Sort map entries by key (lexicographic byte order) for BTreeMap compatibility. */
export function sortedMap(
    map: Map<number[], number[]>,
): Map<number[], number[]> {
    const entries = [...map.entries()].sort(([a], [b]) => {
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            if (a[i] !== b[i]) return (a[i] ?? 0) - (b[i] ?? 0);
        }
        return a.length - b.length;
    });
    return new Map(entries);
}

export const stateInitSchema = BorshSchema.Enum({
    V1: stateInitV1Schema,
});

export type GlobalContractId =
    | { hash: number[] }
    | { account_id: string };


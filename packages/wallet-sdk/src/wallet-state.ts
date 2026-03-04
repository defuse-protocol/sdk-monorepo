import {BorshSchema, borshSerialize} from "borsher";
import {type GlobalContractId, globalContractIdSchema, stateInitSchema, stateInitV1Schema} from "./types/state";
import {keccak_256} from "@noble/hashes/sha3";
import {base58, base64, hex} from "@scure/base";

export type Storage = Map<Uint8Array, Uint8Array>;

export class WalletState {
    public readonly DEFAULT_WALLET_ID = 0;
    public signature_enabled: boolean;
    public seqno: number;
    public wallet_id: number;
    public public_key: Uint8Array;
    public extensions: string[];


    constructor(publicKeyBytes: Uint8Array, options?: {
        walletId?: number;
        extensions?: string[];
    }) {
        this.signature_enabled = true;
        this.seqno = 0;
        this.wallet_id = options?.walletId ?? this.DEFAULT_WALLET_ID;
        this.public_key = publicKeyBytes;
        this.extensions = options?.extensions ?? [];
    };


    toStorage(): Storage {
        const STATE_KEY: Uint8Array = Uint8Array.from([]);
        const serialized = borshSerialize(BorshSchema.Struct({
            signature_enabled: BorshSchema.bool,
            seqno: BorshSchema.u32,
            wallet_id: BorshSchema.u32,
            public_key: BorshSchema.Array(BorshSchema.u8, this.public_key.length),
            extensions: BorshSchema.Vec(BorshSchema.String),
        }), {
            signature_enabled: this.signature_enabled,
            seqno: this.seqno,
            wallet_id: this.wallet_id,
            public_key: Array.from(this.public_key),
            extensions: this.extensions,
        });

        return new Map([[STATE_KEY, serialized]]);
    }
}

export class StateInit {
    public code: GlobalContractId;
    public data: Storage;

    constructor(_code: GlobalContractId, _data: Storage) {
        this.data = _data;
        this.code = _code
    }

    toJSON() {
        let code: { hash: string } | { account_id: string };
        if ("hash" in this.code) {
            code = {hash: base58.encode(new Uint8Array(this.code.hash))};
        } else {
            code = {account_id: this.code.account_id};
        }
        return {
            version: "v1",
            code,
            data: Object.fromEntries(
                this.sortedEntries(this.data).map(([k, v]) => [
                    base64.encode(k),
                    base64.encode(v),
                ]),
            ),
        };
    }

    private sortedEntries(map: Map<Uint8Array, Uint8Array>): [Uint8Array, Uint8Array][] {
        return [...map.entries()].sort(([a], [b]) => {
            const len = Math.min(a.length, b.length);
            for (let i = 0; i < len; i++) {
                if (a[i] !== b[i]) return a[i] ?? 0 - (b[i] ?? 0);
            }
            return a.length - b.length;
        });
    }

    private borshSerialize(): Uint8Array {
        const stateInit = {
            V1: {
                code: this.code,
                data: this.sortedEntries(this.data).map(([k, v]) => [Array.from(k), Array.from(v)])
            },
        };
        return borshSerialize(BorshSchema.Enum({
            V1: BorshSchema.Struct({
                code: BorshSchema.Enum({
                    hash: BorshSchema.Array(BorshSchema.u8, 32),
                    account_id: BorshSchema.String,
                }),
                data: BorshSchema.Vec(
                    BorshSchema.Array(BorshSchema.Vec(BorshSchema.u8), 2)
                ),
            }),
        }), stateInit);
    }

    deriveAccountId(): string {
        const hash = keccak_256(this.borshSerialize());
        return `0s${hex.encode(hash.slice(12, 32))}`;
    }
}
import {
    DEFAULT_WALLET_ID,
    getKeyLength,
    sortedMap,
    STATE_KEY,
    stateInitSchema,
    type GlobalContractId,
    type WalletState,
    walletStateSchema,
} from "./types/state";
import {base58, base64, hex} from "@scure/base";
import {p256} from "@noble/curves/p256";
import type {ProofParams, RequestMessage} from "./types/wallet";
import {type Blockchain, PromiseSingle} from "./promise-single";
import {borshSerialize} from "borsher";
import {keccak_256} from "@noble/hashes/sha3";
import {serializeRequestMessage} from "./borsh/serialize";
import {sha256} from "@noble/hashes/sha2";

export type WalletContractVariant = "webauthn-p256" | "webauthn-ed25519";

export type StateInitSerialized = {
    codeHash?: string;
    accountId?: string;
    data: { [p: string]: number[] };
};

export class WalletContract {
    private readonly pubKeyBytes: Uint8Array;
    private readonly globalContractId: GlobalContractId;
    private readonly walletContractVariant: WalletContractVariant;

    constructor(publicKey: string, contractType: WalletContractVariant) {
        if (!this.isHex(publicKey)) {
            throw new Error("Public key must be in hex format");
        }

        const normalized = publicKey.startsWith("0x")
            ? publicKey.slice(2)
            : publicKey;
        const raw = hex.decode(normalized);


        this.walletContractVariant = contractType;
        switch (this.walletContractVariant) {
            case "ED25519":
                this.globalContractId = WalletEd25519Global;
                break;
            case "P256":
                this.globalContractId = WalletP256Global;
                break;
            default:
                throw new Error(`Not found contract type ${contractType}`);
        }
    }

    public walletDomain() {
        return new TextEncoder().encode("NEAR_WALLET_CONTRACT/V1");
    }

    private deadline(deadline_sec: number = 30) {
        return new Date(Date.now() + deadline_sec * 1000).toISOString();
    }

    private isHex(str: string) {
        return /^(0x)?[0-9a-fA-F]+$/.test(str);
    }

    async preparePayload(
        custom_payload: string,
        seqno: number,
        blockchain: Blockchain,
        deadline_sec?: number,
    ): Promise<{
        message: RequestMessage;
        challenge: string;
        accountId: string;
    }> {
        const deadline = this.deadline(deadline_sec);

        const walletAccountId = this.deriveAccountId(this.globalContractId);

        const promiseThen = new PromiseSingle(blockchain).build(custom_payload);

        const message: RequestMessage = {
            chain_id: "mainnet",
            request: {
                ops: [],
                out: {
                    after: [],
                    then: promiseThen,
                },
            },
            seqno,
            signer_id: walletAccountId,
            valid_until: deadline,
        };

        const challenge = this.computeChallenge(message);

        return {message, challenge, accountId: walletAccountId};
    }

    createWalletState = (options?: {
        walletId?: number;
        extensions?: string[];
    }): WalletState => ({
        signature_enabled: true,
        seqno: 0,
        wallet_id: options?.walletId ?? DEFAULT_WALLET_ID,
        public_key: this.pubKeyBytes,
        extensions: options?.extensions ?? [],
    });

    stateInit(walletState: WalletState): StateInitSerialized {
        let code: { codeHash: string } | { accountId: string };
        if ("CodeHash" in this.globalContractId) {
            code = {
                codeHash: hex.encode(new Uint8Array(this.globalContractId.codeHash)),
            };
        } else {
            code = {accountId: this.globalContractId.AccountId};
        }
        return {
            ...code,
            data: Object.fromEntries(
                [...this.initState(walletState).entries()].map(([k, v]) => [
                    JSON.stringify(k),
                    Array.from(v),
                ]),
            ),
        };
    }

    /**
     * Returns initialization state for Deterministic AccountId derivation
     * as per NEP-616. Produces a `Map<number[], number[]>` where the single
     * entry is `[b"", borsh(state)]`.
     */
    initState = (state: WalletState): Map<number[], number[]> => {
        const keyLength = getKeyLength(state.public_key);
        const serialized = borshSerialize(walletStateSchema(keyLength), {
            ...state,
            public_key: Array.from(state.public_key),
        });
        return new Map([[STATE_KEY, Array.from(serialized)]]);
    };

    /**
     * Derives a deterministic AccountId from a StateInit, according to NEP-616.
     * `accountId = "0s" + hex(keccak256(borsh(stateInit))[12..32])`
     */
    deriveAccountId = (
        walletGlobalId: GlobalContractId,
        options?: {
            walletId?: number;
            extensions?: string[];
        },
    ): string => {
        const state = this.createWalletState(options);
        const data = this.initState(state);

        const stateInit = {
            V1: {code: walletGlobalId, data},
        };

        const serialized = borshSerialize(stateInitSchema, stateInit);
        const hash = keccak_256(serialized);
        return `0s${hex.encode(hash.slice(12, 32))}`;
    };

    async sendSign(opts: {
        message: RequestMessage;
        proof: string;
        baseUrl: string;
        authToken?: string;
    }): Promise<{ status: number; body: string }> {
        const accountId = this.deriveAccountId(this.globalContractId);
        const walletState = this.createWalletState();
        const stateInit = this.stateInit(walletState);

        // TODO maybe refactor
        const res = await fetch(`${opts.baseUrl}/v0/sign`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Authorization: `Bearer ${opts.authToken}`,
            },
            body: JSON.stringify({
                msg: JSON.stringify(opts.message),
                proof: opts.proof,
                accountId,
                stateInit: JSON.stringify(stateInit),
            }),
        });

        const body = await res.text();
        return {status: res.status, body};
    }

    computeChallenge(msg: RequestMessage): string {
        const contractPrefix = this.walletDomain();
        const borshBytes = serializeRequestMessage(msg);
        const prefixed = new Uint8Array(contractPrefix.length + borshBytes.length);
        prefixed.set(contractPrefix);
        prefixed.set(borshBytes, contractPrefix.length);
        return base64.encode(sha256(prefixed));
    }

    buildProof(proofParams: ProofParams) {
        let signature: string;
        switch (this.walletContractVariant) {
            case "webauthn-p256": {
                // WebAuthn produces DER-encoded signatures; convert to raw (r, s) 64-byte format
                const derBytes = hex.decode(proofParams.signature);
                // Normalize to low-S: the on-chain contract rejects high-S signatures
                const sig = p256.Signature.fromDER(derBytes).normalizeS();
                signature = `p256:${base58.encode(sig.toCompactRawBytes())}`;
                break;
            }
            case "webauthn-ed25519":
                signature = `ed25519:${base58.encode(hex.decode(proofParams.signature))}`;
                break;
            default:
                throw new Error("Unsupported type");
        }
        return JSON.stringify({
            authenticator_data: proofParams.authenticatorData,
            client_data_json: new TextDecoder().decode(new Uint8Array(proofParams.clientDataJSON)),
            signature: signature,
            public_key: hex.encode(this.pubKeyBytes),
        });
    }
}

const WalletEd25519Global: GlobalContractId = {
    hash: [
        ...hex.decode(
            "05e4ee0759cae7440da854c60dc81b34d35561008b0b587333e08d2386c64d5c",
        ),
    ],
};


import type {GlobalContractId} from "./types/state";
import {base58, base64, base64url, hex} from "@scure/base";
import {StateInit} from "./wallet-state";
import {p256} from "@noble/curves/nist";
import {serializeRequestMessage} from "./borsh/serialize";
import {sha256} from "@noble/hashes/sha2";
import type {Request, RequestMessage} from "./types/wallet";
import {DomainId} from "./mpc-contract";
import type {OneClickClient} from "./oneclick-client";
import {BorshSchema, borshSerialize} from "borsher";

type WalletContractOptions = {
    walletId?: number,
    timeoutSecs?: number,
    extensions?: string[],
}

abstract class WalletContract {
    public readonly DEFAULT_WALLET_ID: number = 0;
    public readonly DEFAULT_TIMEOUT_SECS: number = 60 * 60;

    protected readonly WALLET_DOMAIN: Uint8Array = new TextEncoder().encode("NEAR_WALLET_CONTRACT/V1");

    private readonly _walletId: number;
    private readonly _timeoutSecs: number;
    private readonly _extensions: string[];

    private _nonce: number = 0;
    protected readonly client: OneClickClient;

    constructor(
        client: OneClickClient,
        options?: WalletContractOptions,
    ) {
        this.client = client;

        this._walletId = options?.walletId ?? this.DEFAULT_WALLET_ID;
        this._timeoutSecs = options?.timeoutSecs ?? this.DEFAULT_TIMEOUT_SECS;
        this._extensions = options?.extensions ?? [];

    }

    abstract get publicKeyBytes(): Uint8Array;

    abstract get globalContractId(): GlobalContractId;

    get nextNonce(): number {
        const BIT_POS_MASK: number = 0b11111;

        if ((this._nonce & BIT_POS_MASK) == 0) {
            this._nonce = (Math.floor(Math.random() * 0xffffffff) & ~BIT_POS_MASK) >>> 0;
        }

        const n = this._nonce;
        this._nonce++;
        return n;
    }

    get accountId(): string {
        return this.stateInit().deriveAccountId();
    }


    private stateInit(): StateInit {
        const STATE_KEY: Uint8Array = Uint8Array.from([]);

        const serialized = borshSerialize(
            BorshSchema.Struct({
                signature_enabled: BorshSchema.bool,
                wallet_id: BorshSchema.u32,
                public_key: BorshSchema.Array(BorshSchema.u8, this.publicKeyBytes.length),
                timeout_secs: BorshSchema.u32,
                _last_cleaned_at: BorshSchema.u32,
                _old_nonces: BorshSchema.Vec((BorshSchema.u32, BorshSchema.u32)),
                _nonces: BorshSchema.Vec((BorshSchema.u32, BorshSchema.u32)),
                extensions: BorshSchema.Vec(BorshSchema.String),
            }),
            {
                signature_enabled: true,
                wallet_id: this._walletId,
                public_key: Array.from(this.publicKeyBytes),
                timeout_secs: this._timeoutSecs,
                _last_cleaned_at: 0,
                _old_nonces: [],
                _nonces: [],
                extensions: this._extensions,
            },
        );

        return new StateInit(
            this.globalContractId,
            new Map([[STATE_KEY, serialized]]),
        );
    }

    buildRequestMessage(
        request: Request,
    ): RequestMessage {
        return {
            chain_id: "mainnet",
            signer_id: this.accountId,
            nonce: this.nextNonce,
            created_at: new Date(Math.floor(Date.now() / 1000 - 60) * 1000)
                .toISOString()
                .replace(/\.\d{3}Z$/, "Z"),
            timeout_secs: this._timeoutSecs,
            request,
        };
    }

    async sendSign(opts: {
        message: RequestMessage;
        proof: string;
    }): Promise<{ status: number; body: string }> {
        const stateInit = this.stateInit().toJSON();

        return await this.client.sign({
            msg: opts.message,
            proof: opts.proof,
            stateInit,
        });
    }

    async derivePublicKey(path: string, domainId: DomainId): Promise<string> {
        let domain_str: string;
        switch (domainId) {
            case DomainId.Secp256k1:
                domain_str = "secp256k1";
                break;
            case DomainId.Ed25519:
                domain_str = "ed25519";
                break;
            default:
                throw new Error("Unknown domain id");
        }

        return this.client.derivePublicKey({
            path,
            domainId: domain_str,
            predecessor: this.accountId,
        });
    }
}

abstract class WalletWebAuthn extends WalletContract {
    abstract parseSignature(derHex: string): string;

    challenge(requestMessage: RequestMessage): string {
        const contractPrefix = this.WALLET_DOMAIN;
        const borshBytes = serializeRequestMessage(requestMessage);
        const prefixed = new Uint8Array(contractPrefix.length + borshBytes.length);
        prefixed.set(contractPrefix);
        prefixed.set(borshBytes, contractPrefix.length);
        return base64.encode(sha256(prefixed));
    }

    buildProof(response: AuthenticatorAssertionResponse) {
        const signatureHex = hex.encode(new Uint8Array(response.signature));
        return JSON.stringify({
            authenticator_data: base64url.encode(
                new Uint8Array(response.authenticatorData),
            ),
            client_data_json: new TextDecoder().decode(
                new Uint8Array(response.clientDataJSON),
            ),
            signature: this.parseSignature(signatureHex),
        });
    }
}

export class WalletWebAuthnP256 extends WalletWebAuthn {
    private readonly _publicKeyBytes: Uint8Array;

    /**
     * @param client - OneClickClient for HTTP calls.
     * @param _publicKeyBytes - Compressed SEC1 encoded coordinates.
     * @param options
     */
    constructor(client: OneClickClient, _publicKeyBytes: string, options?: WalletContractOptions,
    ) {
        super(client, options);
        // For P-256 uncompressed keys (65 bytes), compress to 33 bytes
        this._publicKeyBytes = p256.Point.fromHex(_publicKeyBytes).toBytes(true);
    }

    get globalContractId(): GlobalContractId {
        return {
            account_id: "0sa8247564c6774a33b975a053fc4fbebbd869772d",
        };
    }

    get publicKeyBytes(): Uint8Array {
        return this._publicKeyBytes;
    }

    parseSignature(derHex: string): string {
        // Normalize to low-S: the on-chain contract rejects high-S signatures
        const sig = p256.Signature.fromBytes(hex.decode(derHex), 'der').normalizeS();
        return `p256:${base58.encode(sig.toBytes('compact'))}`;
    }
}

import {type GlobalContractId, stateInitSchema} from "./types/state";
import {borshSerialize} from "borsher";
import {keccak_256} from "@noble/hashes/sha3";
import {base58, base64, base64url, hex} from "@scure/base";
import {StateInit, WalletState} from "./wallet-state";
import {p256} from "@noble/curves/p256";
import {serializeRequestMessage} from "./borsh/serialize";
import {sha256} from "@noble/hashes/sha2";
import type {RequestMessage, Request, ProofParams} from "./types/wallet";
import {PromiseSingle} from "./promise-single";


abstract class WalletContract {
    public readonly walletId: number;
    public readonly extensions: string[];

    constructor(
        _walletId: number = 0,
        _extensions: string[] = []
    ) {
        this.walletId = _walletId;
        this.extensions = _extensions;
    }

    abstract publicKeyBytes(): Uint8Array;

    abstract proof(): string;

    abstract globalContractId(): GlobalContractId;


    protected walletDomain() {
        return new TextEncoder().encode("NEAR_WALLET_CONTRACT/V1");
    }

    deriveAccountId(): string {
        return this.stateInit().deriveAccountId();
    }

    private stateInit(): StateInit {
        return new StateInit(this.globalContractId(), new WalletState(this.publicKeyBytes(), {
            walletId: this.walletId,
            extensions: this.extensions
        }).toStorage());
    }


    async buildRequestMessage(request: Request, timeout_secs: number = 60): Promise<RequestMessage> {
        return {
            chain_id: "mainnet",
            request,
            // TODO async poll from relayer
            seqno: 0,
            signer_id: this.deriveAccountId(),
            valid_until: new Date(Math.floor(Date.now() / 1000) * 1000 + timeout_secs * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
        };
    }

    async sendSign(opts: {
        message: RequestMessage;
        proof: string;
        baseUrl: string;
        authToken?: string;
    }): Promise<{ status: number; body: string }> {
        const accountId = this.deriveAccountId();
        const stateInit = this.stateInit()

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


}

abstract class WalletWebAuthn extends WalletContract {
    abstract parseSignature(derHex: string): string;

    challenge(requestMessage: RequestMessage): string {
        const contractPrefix = this.walletDomain();
        const borshBytes = serializeRequestMessage(requestMessage);
        const prefixed = new Uint8Array(contractPrefix.length + borshBytes.length);
        prefixed.set(contractPrefix);
        prefixed.set(borshBytes, contractPrefix.length);
        return base64.encode(sha256(prefixed));
    }

    buildProof(response: AuthenticatorAssertionResponse) {
        const signatureHex = hex.encode(new Uint8Array(response.signature));
        return JSON.stringify({
            authenticator_data: base64url.encode(new Uint8Array(response.authenticatorData)),
            client_data_json: new TextDecoder().decode(new Uint8Array(response.clientDataJSON)),
            signature: this.parseSignature(signatureHex),
            public_key: hex.encode(this.publicKeyBytes()),
        });
    }

}

export class WalletWebAuthnP256 extends WalletWebAuthn {
    private readonly _publicKeyBytes: Uint8Array;

    /**
     * @param _publicKeyBytes - Compressed SEC1 encoded coordinates.
     */
    constructor(
        _publicKeyBytes: string
    ) {
        super();
        // For P-256 uncompressed keys (65 bytes), compress to 33 bytes
        this._publicKeyBytes = p256.ProjectivePoint.fromHex(_publicKeyBytes).toRawBytes(true)
    }

    proof(): string {
        throw new Error("Method not implemented.");
    }

    globalContractId(): GlobalContractId {
        return {
            hash: [
                ...hex.decode(
                    "8f028370f5ac3da4aa123a986819fef9ed565eef9d3b03d6634ca94e28e5b476",
                ),
            ],
        };

    }

    publicKeyBytes(): Uint8Array {
        return this._publicKeyBytes
    }

    parseSignature(derHex: string): string {
        // Normalize to low-S: the on-chain contract rejects high-S signatures
        const sig = p256.Signature.fromDER(derHex).normalizeS();
        return `p256:${base58.encode(sig.toCompactRawBytes())}`;
    }

}


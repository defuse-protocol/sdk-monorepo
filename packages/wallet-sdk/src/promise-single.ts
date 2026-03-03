import {base64} from "@scure/base";
import type {PromiseSingle as PromiseSingleType} from "./types/wallet";

export enum Blockchain {
    Near,
    Ethereum,
    Solana,
}

// todo change ab
export class PromiseSingle {
    private readonly networkId: Blockchain;

    constructor(_networkId: Blockchain) {
        this.networkId = _networkId;
    }

    // domain_id │  Scheme   │                           Use Case                            │
    //   ├───────────┼───────────┼───────────────────────────────────────────────────────────────┤
    //   │ 0         │ Secp256k1 │ ECDSA signing — for EVM chains (Ethereum, BSC, etc.), Bitcoin │
    //   ├───────────┼───────────┼───────────────────────────────────────────────────────────────┤
    //   │ 1         │ Ed25519   │ EdDSA signing — for Solana, TON, Stellar, NEAR                │
    //   ├───────────┼───────────┼───────────────────────────────────────────────────────────────┤
    //   │ 2         │ Bls12381  │ BLS signing — for Confidential Key Derivation                 │
    //   └───────────┴───────────┴───────────────────────────────────────────────────────────────┘
    private buildRequest(payload: string, path: string = "") {
        const secp256k1Domain = 0;
        const ed25519Domain = 1;

        switch (this.networkId) {
            case Blockchain.Ethereum:
                return {
                    request: {
                        payload_v2: {Ecdsa: payload},
                        domain_id: secp256k1Domain,
                        path,
                    },
                };
            case Blockchain.Solana:
                return {
                    request: {
                        payload_v2: {Eddsa: payload},
                        domain_id: ed25519Domain,
                        path,
                    },
                };
            default:
                return {
                    request: {
                        payload_v2: {Eddsa: payload},
                        domain_id: ed25519Domain,
                        path,
                    },
                };

        }
    }

    build(payload: string): PromiseSingleType[] {
        const argsJson = JSON.stringify(this.buildRequest(payload));
        const argsBase64 = base64.encode(new TextEncoder().encode(argsJson));

        return [
            {
                receiver_id: "v1.signer",
                actions: [
                    {
                        action: "function_call",
                        function_name: "sign",
                        args: argsBase64,
                        deposit: "1",
                    },
                ],
            },
        ];
    }
}

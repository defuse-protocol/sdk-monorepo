import {assert, describe, it} from "vitest";
import {WalletContract} from "./wallet";
import {Blockchain} from "./promise-single";
import type {RequestMessage, Request} from "./types/wallet";
import {WalletWebAuthnP256} from "./wallet-contract";
import {hex} from "@scure/base";

describe("WalletContract", () => {
    it("posts sign request to localhost:3004", async () => {
        const publicKey = "0409c042c611202b078339d167e6c0a0f2325183eee744bc3973b9dd4bb2f89fe501f4088b3080b95316b0ca6c4bed02028040dfd3a487fcfb80d0f5f89bd85d35";

        const wallet = new WalletWebAuthnP256(publicKey);
        const derived = wallet.deriveAccountId();
        const request: Request = {
            ops: [], out: {
                after: [],
                then: []
            }
        }
        const requestMessage = await wallet.buildRequestMessage(request);
        const challenge = wallet.challenge(requestMessage);
        // console.log(hex.encode(wallet.publicKeyBytes()))
        // console.log(derived)
        console.log(requestMessage)
        console.log(challenge)
    });
});

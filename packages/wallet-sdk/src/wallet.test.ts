import {describe, expect, it} from "vitest";
import {WalletContract} from "./wallet";

import {bytesToHex} from "@noble/hashes/utils";

describe("WalletContract", () => {
    it("posts sign request to localhost:3004", async () => {
        const publicKey =
            "046f2c554219fabc56a1ce91ea0c30107c445bb51700d8a6a4d83e3ce870b127c9a43d503f36f22621a6119ce9d9889c8597f04d6c1e4c34cedef29aa080a9829c";

        const wallet = new WalletContract(publicKey, "P256");
        const payload =
            "0xdc8dedffa6ec7ae451b86508b3a608d2bbb88f2b601c7061c1dacf5d28d8937b";

        const {message, challenge, accountId} = await wallet.preparePayload(
            payload,
            0,
        );

        const authData = {
            id: "GOW5hI2A-jSfrUrm0-CKchsvwYI",
            rawId: "GOW5hI2A-jSfrUrm0-CKchsvwYI",
            type: "public-key",
            authenticatorAttachment: "platform",
            response: {
                authenticatorData: "PpZrl-Wqt-OFfBpyy2SraN1m7LT0GZORwGA7-6ujYkMdAAAAAA",
                clientDataJSON:
                    "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiMjNhNzNmYjExMTJhMzM0ODQxNDI5NjY1NjRiZDIwZTEzODUyMjYyZDQyZDYxNmU3ZjMyMTllMWRlMThhNTZlNiIsIm9yaWdpbiI6Imh0dHBzOi8vd3d3LnBhc3NrZXlzLWRlYnVnZ2VyLmlvIiwiY3Jvc3NPcmlnaW4iOmZhbHNlfQ",
                signature:
                    "MEQCIHECh0zQsrn-cJusHDHMObc0gBiC_87WQl8-4BOdCF3kAiBenaFudrpkayN7fXvXC9D4ntX-1I4VQWMCXi5O4-wK9w",
                userHandle: "CtsR2jxA8O9Z3RXXmNrWHp-aWPZGG0l_jZZJR3dac2g",
            },
        };

        const proof = JSON.stringify({
            authenticator_data: authData.response.authenticatorData,
            client_data_json: authData.response.clientDataJSON,
            signature: authData.response.signature,
            public_key: publicKey,
        });

        const walletState = wallet.createWalletState();

        console.log("Message:", JSON.stringify(message));
        console.log("Proof:", proof);
        console.log("Challenge:", bytesToHex(challenge));

        const {status, body} = await wallet.sendSign({
            message,
            proof,
            publicKey,
            baseUrl: "http://localhost:3000",
            authToken: process.env.DEFUSE_AUTH!,
        });

        console.log(body);
    });
});

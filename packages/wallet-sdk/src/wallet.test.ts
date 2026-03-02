import {assert, describe, it} from "vitest";
import {Blockchain, WalletContract} from "./wallet";

describe("WalletContract", () => {
    it("posts sign request to localhost:3004", async () => {
        const publicKey = "TO_DO_PUBLIC_KEY";

        const wallet = new WalletContract(publicKey, "P256");
        const payload = "TO_DO_PAYLOAD";

        const {message, challenge, accountId} = await wallet.preparePayload(
            payload,
            0,
            Blockchain.Solana,
        );

        const authData = {
            id: "-",
            rawId: "-",
            type: "public-key",
            authenticatorAttachment: "platform",
            response: {
                authenticatorData: "-",
                clientDataJSON: "-",
                signature: "-",
                userHandle: "-",
            },
        };

        const proof = JSON.stringify({
            authenticator_data: authData.response.authenticatorData,
            client_data_json: authData.response.clientDataJSON,
            signature: authData.response.signature,
            public_key: publicKey,
        });

        const walletState = wallet.createWalletState();

        // console.log("Message:", JSON.stringify(message));
        // console.log("Proof:", proof);
        // console.log("Challenge:", bytesToHex(challenge));

        const {status, body} = await wallet.sendSign({
            message,
            proof,
            publicKey,
            baseUrl: "http://localhost:3000",
            authToken: process.env.DEFUSE_AUTH!,
        });

        assert(status == 200);
        assert(body.length);
    });
});

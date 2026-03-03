import {assert, describe, it} from "vitest";
import {WalletContract} from "./wallet";
import {Blockchain} from "./promise-single";
import type {RequestMessage} from "./types/wallet";

describe("WalletContract", () => {
    it("posts sign request to localhost:3004", async () => {
        const publicKey = "";

        const wallet = new WalletContract(publicKey, "P256");
        // const payload = "TO_DO_PAYLOAD";
        //
        // const {message, challenge, accountId} = await wallet.preparePayload(
        //     payload,
        //     0,
        //     Blockchain.Solana,
        // );
        //
        // const authData = {
        //     id: "-",
        //     rawId: "-",
        //     type: "public-key",
        //     authenticatorAttachment: "platform",
        //     response: {
        //         authenticatorData: "-",
        //         clientDataJSON: "-",
        //         signature: "-",
        //         userHandle: "-",
        //     },
        // };
        //
        // const proof = wallet.buildProof({
        //     clientDataJSON: authData.response.clientDataJSON, publicKey, signature: authData.response.signature,
        //     authenticatorData: authData.response.authenticatorData
        // })
        //
        // const walletState = wallet.createWalletState();

        // console.log("Message:", JSON.stringify(message));
        // console.log("Proof:", proof);
        // console.log("Challenge:", bytesToHex(challenge));

        // const {status, body} = await wallet.sendSign({
        //     message: REQUEST,
        //     proof: PROOF,
        //     baseUrl: "http://localhost:3000",
        //     authToken: JWT,
        // });
        //
        // console.log(process.env.DEFUSE_AUTH)
        // console.log(body)
        // assert(status == 200);
        // assert(body.length);
    });
});

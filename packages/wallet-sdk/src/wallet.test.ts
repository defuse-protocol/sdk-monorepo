import {describe, it} from "vitest";
import {WalletContract} from "./wallet";
import {WalletWebAuthnP256} from "./wallet-contract";
import {DomainId, MpcContract} from "./mpc-contract";
import {hex} from "@scure/base";

describe("WalletContract", () => {
    it("posts sign request to localhost:3004", async () => {
        const publicKey = "0409c042c611202b078339d167e6c0a0f2325183eee744bc3973b9dd4bb2f89fe501f4088b3080b95316b0ca6c4bed02028040dfd3a487fcfb80d0f5f89bd85d35";

        const wallet = new WalletWebAuthnP256(publicKey);
        const derived = wallet.deriveAccountId();
        const mpcContract = new MpcContract();
        const request = mpcContract.buildSignMpcRequest(DomainId.Secp256k1, hex.decode("8059971b41bf105f57570ece5b214cdbee68e61ca2de6a3f1b33c3ef12384c2a"))
        const requestMessage = await wallet.buildRequestMessage(request);
        const challenge = wallet.challenge(requestMessage);
        const public_key = await wallet.derivePublicKey("", DomainId.Secp256k1);
        // console.log(hex.encode(wallet.publicKeyBytes()))
        console.log(public_key)
        // console.log(JSON.stringify(requestMessage))
        // console.log(challenge)
    });
});

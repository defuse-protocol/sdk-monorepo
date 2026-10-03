import { hex } from "@scure/base";
import { describe, expect, it } from "vitest";
import { DomainId, MpcContract } from "./mpc-contract";
import { OneClickClient } from "./oneclick-client";
import { WalletWebAuthnP256 } from "./wallet-contract";

describe("WalletContract", () => {
	it("builds a sign request message and challenge", async () => {
		const publicKey =
			"0409c042c611202b078339d167e6c0a0f2325183eee744bc3973b9dd4bb2f89fe501f4088b3080b95316b0ca6c4bed02028040dfd3a487fcfb80d0f5f89bd85d35";

		const client = new OneClickClient({ baseUrl: "http://localhost:3000" });
		const wallet = new WalletWebAuthnP256(client, publicKey);
		const accountId = wallet.accountId;
		const mpcContract = new MpcContract();
		const request = mpcContract.buildSignMpcRequest(
			DomainId.Secp256k1,
			hex.decode(
				"8059971b41bf105f57570ece5b214cdbee68e61ca2de6a3f1b33c3ef12384c2a",
			),
		);
		const requestMessage = wallet.buildRequestMessage(request);
		const challenge = wallet.challenge(requestMessage);

		expect(accountId).toMatch(/^0s[0-9a-f]{40}$/);
		expect(requestMessage.signer_id).toBe(accountId);
		expect(challenge.length).toBeGreaterThan(0);
	});
});

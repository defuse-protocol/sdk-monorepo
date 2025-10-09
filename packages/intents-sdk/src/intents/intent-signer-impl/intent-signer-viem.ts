import { utils } from "@defuse-protocol/internal-utils";
import type { Account } from "viem";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

export type IntentSignerViemConfig = {
	/**
	 * Instance of viem's Account type
	 * @see https://viem.sh/docs/accounts/local/privateKeyToAccount
	 */
	signer: Pick<Account, "address" | "signMessage">;
	/**
	 * Optional account ID to be used as signer_id of the intent.
	 * If not provided, the signer_id will be derived from the signer's address.
	 */
	accountId?: string;
};

export class IntentSignerViem implements IIntentSigner {
	constructor(private config: IntentSignerViemConfig) {}

	async signIntent(intent: IntentPayload): Promise<MultiPayload> {
		const payload = JSON.stringify({
			signer_id:
				intent.signer_id ??
				this.config.accountId ??
				utils.authHandleToIntentsUserId({
					identifier: this.config.signer.address,
					method: "evm",
				}),
			verifying_contract: intent.verifying_contract,
			deadline: intent.deadline,
			nonce: intent.nonce,
			intents: intent.intents,
		});

		const signature = await this.config.signer.signMessage?.({
			message: payload,
		});
		if (signature == null) {
			throw new Error("No signature is returned");
		}

		return {
			standard: "erc191",
			payload,
			signature: utils.transformERC191Signature(signature),
		};
	}
}

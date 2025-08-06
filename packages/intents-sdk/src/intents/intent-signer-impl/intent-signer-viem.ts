import { utils } from "@defuse-protocol/internal-utils";
import type { Account } from "viem";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

export type IntentSignerViemConfig = Pick<Account, "address" | "signMessage">;

export class IntentSignerViem implements IIntentSigner {
	constructor(private account: IntentSignerViemConfig) {}

	async signIntent(intent: IntentPayload): Promise<MultiPayload> {
		const payload = JSON.stringify({
			signer_id:
				intent.signer_id ??
				utils.authHandleToIntentsUserId({
					identifier: this.account.address,
					method: "evm",
				}),
			verifying_contract: intent.verifying_contract,
			deadline: intent.deadline,
			nonce: intent.nonce,
			intents: intent.intents,
		});

		const signature = await this.account.signMessage?.({
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

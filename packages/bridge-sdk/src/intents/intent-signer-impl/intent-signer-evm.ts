import { utils } from "@defuse-protocol/internal-utils";
import type { Account } from "viem";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload, MultiPayload } from "../shared-types";

export class IntentSignerEVM implements IIntentSigner {
	private signer: Account;

	constructor({
		signer,
	}: {
		signer: Account;
	}) {
		this.signer = signer;
	}

	async signIntent(intent: IntentPayload): Promise<MultiPayload> {
		const payload = JSON.stringify({
			signer_id:
				intent.signer_id ??
				utils.authHandleToIntentsUserId({
					identifier: this.signer.address,
					method: "evm",
				}),
			verifying_contract: "intents.near",
			deadline: intent.deadline,
			nonce: intent.nonce,
			intents: intent.intents,
		});

		const signature = await this.signer.signMessage?.({
			message: payload,
		});
		if (signature == null) {
			throw new Error("No signature is returned");
		}

		return {
			standard: "erc191",
			payload,
			signature: utils.transformERC191Signature(signature),
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any as MultiPayload;
	}
}

import type { MultiPayloadErc191 } from "@defuse-protocol/contract-types";
import { utils } from "@defuse-protocol/internal-utils";
import type { Account } from "viem";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type { IntentPayload } from "../shared-types";

export type Erc191RawPayload = Pick<MultiPayloadErc191, "payload">;

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
	readonly standard = "erc191" as const;

	constructor(private config: IntentSignerViemConfig) {}

	async signRaw(input: Erc191RawPayload): Promise<MultiPayloadErc191> {
		const signature = await this.config.signer.signMessage?.({
			message: input.payload,
		});
		if (signature == null) {
			throw new Error("No signature is returned");
		}

		return {
			standard: "erc191",
			payload: input.payload,
			signature: utils.transformERC191Signature(signature),
		};
	}

	/** Builds payload from IntentPayload and signs it via signRaw() */
	async signIntent(intent: IntentPayload): Promise<MultiPayloadErc191> {
		return this.signRaw({
			payload: JSON.stringify({
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
			}),
		});
	}
}

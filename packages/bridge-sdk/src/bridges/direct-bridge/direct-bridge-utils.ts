import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import { assert } from "../../lib/assert.ts";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
}): IntentPrimitive {
	const { contractId: tokenAccountId, standard } = parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");
	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: params.destinationAddress,
		amount: params.amount.toString(),
		storage_deposit:
			params.storageDeposit > 0n ? params.storageDeposit.toString() : null,
	};
}

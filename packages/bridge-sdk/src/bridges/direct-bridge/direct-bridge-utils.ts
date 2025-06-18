import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { NEAR_NATIVE_ASSET_ID } from "./direct-bridge-constants";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
}): IntentPrimitive {
	if (params.assetId === NEAR_NATIVE_ASSET_ID) {
		return {
			intent: "native_withdraw",
			receiver_id: params.destinationAddress,
			amount: params.amount.toString(),
		};
	}

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

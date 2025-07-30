import { utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import {
	OMNI_BRIDGE_CONTRACT,
	supportedNetworks,
} from "./omni-bridge-constants";
import type { CAIP2_NETWORK } from "../../lib/caip2";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
	origin: CAIP2_NETWORK;
	transferredTokenFee: bigint;
}): IntentPrimitive {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");
	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: OMNI_BRIDGE_CONTRACT,
		amount: params.amount.toString(),
		storage_deposit:
			params.storageDeposit > 0n ? params.storageDeposit.toString() : null,
		msg: JSON.stringify({
			//@ts-ignore
			recipient: `${supportedNetworks[params.origin]}:${params.destinationAddress}`,
			fee: params.transferredTokenFee.toString(),
			native_token_fee: "0",
		}),
	};
}

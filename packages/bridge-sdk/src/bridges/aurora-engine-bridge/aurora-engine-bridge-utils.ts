import { utils } from "@defuse-protocol/internal-utils";
import { getAddress } from "viem";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import type { BridgeKind, WithdrawalParams } from "../../shared-types";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	auroraEngineContractId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
}): IntentPrimitive {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");

	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: params.auroraEngineContractId,
		amount: params.amount.toString(),
		msg: makeAuroraEngineDepositMsg(params.destinationAddress),
		storage_deposit:
			params.storageDeposit > 0n ? params.storageDeposit.toString() : null,
	};
}

/**
 * In order to deposit to AuroraEngine powered chain, we need to have a `msg`
 * with the destination address in special format (lower case + without 0x).
 */
function makeAuroraEngineDepositMsg(recipientAddress: string): string {
	const parsedRecipientAddress = getAddress(recipientAddress);
	return parsedRecipientAddress.slice(2).toLowerCase();
}

export function withdrawalParamsInvariant(
	params: WithdrawalParams,
): asserts params is WithdrawalParams & {
	bridgeConfig: Exclude<
		NonNullable<WithdrawalParams["bridgeConfig"]>,
		{ bridge: Exclude<BridgeKind, "aurora_engine"> }
	>;
} {
	assert(params.bridgeConfig != null, "Bridge config is required");
	assert(
		params.bridgeConfig.bridge === "aurora_engine",
		"Bridge is not aurora_engine",
	);
}

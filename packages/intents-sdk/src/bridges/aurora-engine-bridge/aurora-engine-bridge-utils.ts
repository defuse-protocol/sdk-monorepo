import { assert, utils } from "@defuse-protocol/internal-utils";
import { getAddress } from "viem";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type { WithdrawalParams } from "../../shared-types";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	auroraEngineContractId: string;
	proxyTokenContractId: string | null;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
}): IntentPrimitive {
	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		params.assetId,
	);
	assert(standard === "nep141", "Only NEP-141 is supported");

	// Most cases
	if (params.proxyTokenContractId == null) {
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

	//  Flow for transferring a base token to a virtual chain with a non-standard (non-ETH) base token
	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: params.proxyTokenContractId,
		amount: params.amount.toString(),
		msg: `${params.auroraEngineContractId}:${makeAuroraEngineDepositMsg(params.destinationAddress)}`,
		storage_deposit:
			params.storageDeposit > 0n ? params.storageDeposit.toString() : null,
	};
}

/**
 * To deposit to AuroraEngine powered chain, we need to have a `msg`
 * with the destination address in a special format (lower case + without 0x).
 */
function makeAuroraEngineDepositMsg(recipientAddress: string): string {
	const parsedRecipientAddress = getAddress(recipientAddress);
	return parsedRecipientAddress.slice(2).toLowerCase();
}

export function withdrawalParamsInvariant<
	T extends Pick<WithdrawalParams, "routeConfig">,
>(
	params: T,
): asserts params is T & {
	routeConfig: Extract<
		NonNullable<T["routeConfig"]>,
		{ route: RouteEnum["VirtualChain"] }
	>;
} {
	const routeConfigNullErrorMessage = "Bridge config is required";
	assert(params.routeConfig != null, routeConfigNullErrorMessage);

	assert(
		params.routeConfig!.route === RouteEnum.VirtualChain,
		"Bridge is not aurora_engine",
	);
}

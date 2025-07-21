import { utils } from "@defuse-protocol/internal-utils";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import type { WithdrawalParams } from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./direct-bridge-constants";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
	msg: string | undefined;
}): IntentPrimitive {
	if (
		params.assetId === NEAR_NATIVE_ASSET_ID &&
		// Ensure `msg` is not passed, because `native_withdraw` intent doesn't support `msg`
		params.msg === undefined
	) {
		return {
			intent: "native_withdraw",
			receiver_id: params.destinationAddress,
			amount: params.amount.toString(),
		};
	}

	const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
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
		msg: params.msg,
	};
}

export function withdrawalParamsInvariant<
	T extends Pick<WithdrawalParams, "bridgeConfig">,
>(
	params: T,
): asserts params is T & {
	bridgeConfig?: Extract<
		NonNullable<T["bridgeConfig"]>,
		{ bridge: RouteEnum["NearWithdrawal"] }
	>;
} {
	assert(
		!params.bridgeConfig
			? true
			: params.bridgeConfig.bridge === RouteEnum.NearWithdrawal,
		"Bridge is not direct",
	);
}

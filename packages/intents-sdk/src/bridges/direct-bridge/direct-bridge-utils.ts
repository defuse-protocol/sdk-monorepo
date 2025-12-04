import {
	assert,
	unwrapNearFailoverRpcProvider,
	utils,
} from "@defuse-protocol/internal-utils";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type { WithdrawalParams } from "../../shared-types";
import {
	MIN_GAS_AMOUNT,
	NEAR_NATIVE_ASSET_ID,
} from "./direct-bridge-constants";
import { providers } from "near-api-js";

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
			params.storageDeposit > 0n ? params.storageDeposit.toString() : undefined,
		msg: params.msg,
		min_gas: MIN_GAS_AMOUNT,
	};
}

export function withdrawalParamsInvariant<
	T extends Pick<WithdrawalParams, "routeConfig">,
>(
	params: T,
): asserts params is T & {
	routeConfig?: Extract<
		NonNullable<T["routeConfig"]>,
		{ route: RouteEnum["NearWithdrawal"] }
	>;
} {
	assert(
		!params.routeConfig
			? true
			: params.routeConfig.route === RouteEnum.NearWithdrawal,
		"Bridge is not direct",
	);
}

export async function accountExistsInNEAR(
	provider: providers.Provider,
	accountId: string,
): Promise<boolean> {
	try {
		const client = unwrapNearFailoverRpcProvider(provider);
		await client.query({
			request_type: "view_account",
			account_id: accountId,
			finality: "final",
		});
		return true;
	} catch (error) {
		if (
			error instanceof providers.TypedError &&
			error.type === "AccountDoesNotExist"
		) {
			return false;
		}
		throw error;
	}
}

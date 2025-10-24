import {
	assert,
	unwrapNearFailoverRpcProvider,
	utils,
} from "@defuse-protocol/internal-utils";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type { WithdrawalParams } from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./direct-bridge-constants";
import { TypedError, type Provider } from "near-api-js/lib/providers";

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
	provider: Provider,
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
		if (error instanceof TypedError && error.type === "AccountDoesNotExist") {
			return false;
		}
		throw error;
	}
}

import { utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import {
	OMNI_BRIDGE_CONTRACT,
	supportedNetworks,
} from "./omni-bridge-constants";
import type { CAIP2_NETWORK } from "../../lib/caip2";
import { utils as nearUtils } from "near-api-js";
import type { providers } from "near-api-js";

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

export async function getTransferNonce(
	provider: providers.Provider,
	contract: string,
	txHash: string,
): Promise<string | null> {
	try {
		const decodedTxHash = nearUtils.serialize.base_decode(txHash);
		const depositTx = await provider.txStatus(
			decodedTxHash,
			contract,
			"EXECUTED_OPTIMISTIC",
		);
		//@ts-expect-error
		if (depositTx.status.Unknown) {
			// Transaction or receipt not processed yet
			return null;
		}

		//@ts-expect-error
		if (depositTx.status.Failure) {
			return null;
		}

		const receipt = depositTx.receipts_outcome.find(
			(receipt) => receipt.outcome.executor_id === contract,
		);
		if (
			//@ts-ignore
			receipt?.outcome.status["Failure"] !== undefined ||
			receipt?.outcome.logs.length === 0
		) {
			return null;
		}

		const depositLog = JSON.parse(receipt?.outcome.logs[0] as string);
		return depositLog.InitTransferEvent.transfer_message.origin_nonce;
	} catch {
		return null;
	}
}

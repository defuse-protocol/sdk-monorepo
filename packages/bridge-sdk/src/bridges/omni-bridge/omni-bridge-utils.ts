import { utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import { CAIP2_NETWORK } from "../../lib/caip2";
import { omniAddress, ChainKind } from "omni-bridge-sdk";

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
			recipient: omniAddress(
				caip2ToChainKind(params.origin),
				params.destinationAddress,
			),
			fee: params.transferredTokenFee.toString(),
			native_token_fee: "0",
		}),
	};
}

export function caip2ToChainKind(network: CAIP2_NETWORK): ChainKind {
	switch (network) {
		case CAIP2_NETWORK.Ethereum:
			return ChainKind.Eth;
		case CAIP2_NETWORK.Base:
			return ChainKind.Base;
		case CAIP2_NETWORK.Arbitrum:
			return ChainKind.Arb;
		case CAIP2_NETWORK.Solana:
			return ChainKind.Sol;
		default:
			throw new Error(`Unsupported Omni network = ${network}`);
	}
}

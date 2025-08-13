import { assert, utils } from "@defuse-protocol/internal-utils";
import { ChainKind, omniAddress } from "omni-bridge-sdk";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import type { Chain } from "../../lib/caip2";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationAddress: string;
	amount: bigint;
	storageDeposit: bigint;
	origin: Chain;
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

export function caip2ToChainKind(network: Chain): ChainKind {
	switch (network) {
		case Chains.Ethereum:
			return ChainKind.Eth;
		case Chains.Base:
			return ChainKind.Base;
		case Chains.Arbitrum:
			return ChainKind.Arb;
		case Chains.Solana:
			return ChainKind.Sol;
		case Chains.Bitcoin:
			return ChainKind.Btc;
		default:
			throw new Error(`Unsupported Omni network = ${network}`);
	}
}

export function chainKindToCaip2(network: ChainKind): Chain {
	switch (network) {
		case ChainKind.Eth:
			return Chains.Ethereum;
		case ChainKind.Base:
			return Chains.Base;
		case ChainKind.Arb:
			return Chains.Arbitrum;
		case ChainKind.Sol:
			return Chains.Solana;
		case ChainKind.Btc:
			return Chains.Bitcoin;
		default:
			throw new Error(`Unsupported Caip2 network = ${network}`);
	}
}

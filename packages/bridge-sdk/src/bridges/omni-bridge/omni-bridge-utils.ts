import { utils } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { OMNI_BRIDGE_CONTRACT } from "./omni-bridge-constants";
import { CAIP2_NETWORK } from "../../lib/caip2";
import { omniAddress, ChainKind } from "omni-bridge-sdk";
import type { CAIP2_NETWORK as CAIP2_NETWORK_TYPE } from "../../lib/caip2";

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

type AllowedNetworks = Extract<
	CAIP2_NETWORK_TYPE,
	| "eip155:8453"
	| "eip155:1"
	| "eip155:8453"
	| "eip155:42161"
	| "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
>;
export function caip2ToChainKind(network: CAIP2_NETWORK): ChainKind {
	const mapping: Record<Extract<CAIP2_NETWORK, AllowedNetworks>, ChainKind> = {
		[CAIP2_NETWORK.Ethereum]: ChainKind.Eth,
		[CAIP2_NETWORK.Base]: ChainKind.Base,
		[CAIP2_NETWORK.Arbitrum]: ChainKind.Arb,
		[CAIP2_NETWORK.Solana]: ChainKind.Sol,
		// [CAIP2_NETWORK.Bitcoin]: ChainKind.Btc,
	};

	if (mapping[network as keyof typeof mapping]) {
		return mapping[network as keyof typeof mapping]!;
	}

	throw new Error(`Unsupported Omni network = ${network}`);
}

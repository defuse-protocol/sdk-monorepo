import type { Intent } from "@defuse-protocol/contract-types";
import { Network, utils } from "@hot-labs/omni-sdk";
import type { SupportedChainName } from "../types/base";
import { assert } from "./assert";
import { parseDefuseAssetId } from "./tokenUtils";

export function buildHotOmniWithdrawIntent(args: {
	chainName: SupportedChainName;
	defuseAssetId: string;
	amount: bigint;
	receiver: string;
}): Intent {
	const network = toHotOmniNetwork(args.chainName);
	const receiver = utils.encodeReceiver(network, args.receiver);
	return buildWithdrawIntentAction(args.defuseAssetId, args.amount, receiver);
}

// patched version of node_modules/@hot-labs/omni-sdk/src/intents.ts
function buildWithdrawIntentAction(
	defuseAssetId: string,
	amount: bigint,
	receiver: string,
): Intent {
	const token = parseDefuseAssetId(defuseAssetId);
	assert(token.standard === "nep245", "Expected NEP-245 standard token");

	return {
		intent: "mt_withdraw",
		amounts: [amount.toString()],
		receiver_id: utils.OMNI_HOT_V2,
		token_ids: [token.tokenId],
		token: token.contractId,
		memo: receiver,
	};
}

export function toHotOmniNetwork(chainName: SupportedChainName): Network {
	const mapping: { [K in SupportedChainName]?: Network } = {
		bsc: Network.Bnb,
		polygon: Network.Polygon,
	};

	assert(
		mapping[chainName] != null,
		`Unsupported HOT Omni Bridge chain = ${chainName}`,
	);

	// biome-ignore lint/style/noNonNullAssertion: checked above
	return mapping[chainName]!;
}

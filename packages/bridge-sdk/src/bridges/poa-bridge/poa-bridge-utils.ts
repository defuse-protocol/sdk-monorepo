import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import { CAIP2_NETWORK } from "../../lib/caip2.ts";

export function createWithdrawIntentPrimitive(params: {
	assetId: string;
	destinationChain: string;
	destinationAddress: string;
	destinationMemo: string | undefined;
	amount: bigint;
}): Extract<IntentPrimitive, { intent: "ft_withdraw" }> {
	const { contractId: tokenAccountId } = parseDefuseAssetId(params.assetId);
	return {
		intent: "ft_withdraw",
		token: tokenAccountId,
		receiver_id: tokenAccountId,
		amount: params.amount.toString(),
		memo: createWithdrawMemo({
			receiverAddress: params.destinationAddress,
			xrpMemo: params.destinationMemo,
		}),
	};
}

function createWithdrawMemo({
	receiverAddress,
	xrpMemo,
}: {
	receiverAddress: string;
	xrpMemo: string | undefined;
}) {
	const memo = ["WITHDRAW_TO", receiverAddress];

	if (xrpMemo != null && xrpMemo !== "") {
		memo.push(xrpMemo);
	}

	return memo.join(":");
}

export function toPoaNetwork(caip2: string) {
	const mapping = {
		[CAIP2_NETWORK.Base]: "eth:8453",
		[CAIP2_NETWORK.Polygon]: "eth:137",
		[CAIP2_NETWORK.Arbitrum]: "eth:42161",
	};

	if (mapping[caip2] == null) {
		throw new Error(`Unsupported POA Bridge chain = ${caip2}`);
	}
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	return mapping[caip2]!;
}

export function contractIdToCaip2(contractId: string): CAIP2_NETWORK {
	const mapping = {
		eth: CAIP2_NETWORK.Ethereum,
		sol: CAIP2_NETWORK.Solana,
		base: CAIP2_NETWORK.Base,
		tron: CAIP2_NETWORK.Tron,
		gnosis: CAIP2_NETWORK.Gnosis,
		xrp: CAIP2_NETWORK.XRPL,
		doge: CAIP2_NETWORK.Dogecoin,
		arb: CAIP2_NETWORK.Arbitrum,
		btc: CAIP2_NETWORK.Bitcoin,
		zec: CAIP2_NETWORK.Zcash,
		bera: CAIP2_NETWORK.Berachain,
	};

	for (const [prefix, caip2] of Object.entries(mapping)) {
		if (
			contractId.startsWith(`${prefix}.`) ||
			contractId.startsWith(`${prefix}-`)
		) {
			return caip2;
		}
	}

	throw new Error(`Unsupported POA Bridge contractId = ${contractId}`);
}

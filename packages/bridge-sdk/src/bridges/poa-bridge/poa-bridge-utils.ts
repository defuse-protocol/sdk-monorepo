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

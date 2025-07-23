import type { SupportedChainName } from "../types/base";
import type { IntentsUserId } from "../types/intentsUserId";
import { assert, type AssertErrorType } from "../utils/assert";
import { toHotOmniNetwork } from "../utils/hotOmniUtils";
import { hotOmniWithdraw } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient/types";

export type WaitForHotOmniWithdrawalCompletionReturnType = null | {
	destinationTxHash: string | null;
};
export type WaitForHotOmniWithdrawalCompletionErrorType =
	| types.JSONRPCErrorType
	| AssertErrorType;

export async function waitForHotOmniWithdrawalCompletion({
	txHash,
	accountId,
	chainName,
	recipient,
	signal,
}: {
	txHash: string;
	accountId: IntentsUserId;
	chainName: SupportedChainName;
	recipient: string;
	signal: AbortSignal;
}): Promise<WaitForHotOmniWithdrawalCompletionReturnType> {
	const result = await hotOmniWithdraw(
		{
			account_id: accountId,
			chain_id: toHotOmniNetwork(chainName).toString(),
			receiver: recipient,
			tx_hash: txHash,
		},
		{ timeout: 120_000, fetchOptions: { signal } },
	);

	const withdrawal = result[0];
	assert(withdrawal != null, "no withdrawal found");

	if (withdrawal.status === "COMPLETED") {
		return {
			destinationTxHash: withdrawal.data.transfer_tx_hash,
		};
	}

	return null;
}

import type { IntentsUserId } from "../types/intentsUserId";
import { getDepositStatus } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient";

export type PendingDeposit =
	types.GetDepositStatusResponse<"PENDING">["result"]["deposits"][number];

export type GetPendingDepositsErrorType = types.JSONRPCErrorType;

export async function getPendingDeposits(
	accountId: IntentsUserId,
): Promise<PendingDeposit[]> {
	const pendingDeposits: PendingDeposit[] = [];
	const limit = 20;
	let offset = 0;
	do {
		const result = await getDepositStatus({
			account_id: accountId,
			limit,
			offset,
			status: "PENDING",
		});
		pendingDeposits.concat(result.deposits);
		offset += result.deposits.length;
		if (result.deposits.length < limit) break;
	} while (true);

	return pendingDeposits;
}

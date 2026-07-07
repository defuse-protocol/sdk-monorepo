import type { IntentsUserId } from "../types/intentsUserId";
import { getDepositStatus } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient";

export type PendingDeposit =
	types.GetDepositStatusResponse<"PENDING">["result"]["deposits"][number];

export type GetPendingDepositsErrorType = types.JSONRPCErrorType;

const MAX_PAGES = 50;

/**
 * @description Fetches all pending deposits for the given account, paginating through results (20 per page). Capped at 50 as a safeguard against infinite loops from a misbehaving API.
 * @param accountId
 * @returns
 */
export async function getPendingDeposits(
	accountId: IntentsUserId,
): Promise<PendingDeposit[]> {
	const pendingDeposits: PendingDeposit[] = [];
	const limit = 20;
	let offset = 0;
	let page = 0;

	while (page < MAX_PAGES) {
		const result = await getDepositStatus({
			account_id: accountId,
			limit,
			offset,
			status: "PENDING",
		});
		for (const deposit of result.deposits) {
			pendingDeposits.push(deposit);
		}
		offset += result.deposits.length;
		page++;
		if (offset >= result.total || result.deposits.length < limit) break;
	}

	return pendingDeposits;
}

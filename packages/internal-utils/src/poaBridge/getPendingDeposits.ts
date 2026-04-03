import type { IntentsUserId } from "../types/intentsUserId";
import { getDepositStatus } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient";

type DepositStatus =
	types.GetDepositStatusResponse["result"]["deposits"][number];

type PendingDeposit = DepositStatus & { status: "PENDING" };

export type GetPendingDepositsOkType = PendingDeposit[];

export type GetPendingDepositsErrorType = types.JSONRPCErrorType;

function isPending(deposit: DepositStatus): deposit is PendingDeposit {
	return deposit.status === "PENDING";
}

export async function getPendingDeposits(
	accountId: IntentsUserId,
): Promise<GetPendingDepositsOkType> {
	const pendingDeposits: PendingDeposit[] = [];
	const limit = 20;
	let offset = 0;
	do {
		const result = await getDepositStatus({
			account_id: accountId,
			limit,
			offset,
		});
		result.deposits.forEach((deposit) => {
			if (isPending(deposit)) pendingDeposits.push(deposit);
		});
		offset += result.deposits.length;
		if (result.deposits.length < limit) break;
	} while (true);

	return pendingDeposits;
}

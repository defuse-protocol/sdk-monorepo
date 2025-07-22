import type { IntentsUserId } from "../types/intentsUserId";
import { getDepositStatus } from "./poaBridgeHttpClient";
import type * as types from "./poaBridgeHttpClient";

type PendingDeposit =
	types.GetDepositStatusResponse["result"]["deposits"][number] & {
		status: "PENDING";
	};

export type GetPendingDepositsOkType = PendingDeposit[];

export type GetPendingDepositsErrorType = types.JSONRPCErrorType;

export async function getPendingDeposits(
	accountId: IntentsUserId,
): Promise<GetPendingDepositsOkType> {
	const depositStatus = await getDepositStatus({
		account_id: accountId,
	});

	return depositStatus.deposits.filter(
		(a): a is PendingDeposit => a.status === "PENDING",
	);
}

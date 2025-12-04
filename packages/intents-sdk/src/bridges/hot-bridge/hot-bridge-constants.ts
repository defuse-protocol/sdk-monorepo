export const HotWithdrawStatus = {
	Completed: "COMPLETED",
	Canceled: "CANCELED",
} as const;

// This was chosen empirically and may not be optimal, it includes a tiny margin.
export const MIN_GAS_AMOUNT = "83000000000000"; // 83 tgas

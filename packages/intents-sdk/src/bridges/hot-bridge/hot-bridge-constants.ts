export const HotWithdrawStatus = {
	Completed: "COMPLETED",
	Canceled: "CANCELED",
} as const;

// This was chosen empirically and may not be optimal, it includes 10% margin.
export const MIN_GAS_AMOUNT = "91300000000000"; // 91.3 tgas

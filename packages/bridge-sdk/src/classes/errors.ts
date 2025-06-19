import type { FeeEstimation } from "../shared-types";

export class FeeExceedsAmountError extends Error {
	name = "FeeExceedsAmountError";

	constructor(
		public feeEstimation: FeeEstimation,
		public amount: bigint,
	) {
		super("Amount too small to pay fee");
	}
}

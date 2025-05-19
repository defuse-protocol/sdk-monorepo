export class FeeExceedsAmountError extends Error {
	name = "FeeExceedsAmountError";

	constructor(
		public fee: bigint,
		public amount: bigint,
	) {
		super("Amount too small to pay fee");
	}
}

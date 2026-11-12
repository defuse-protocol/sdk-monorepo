import { BaseError } from "../../errors/base";

export type StellarAccountNotFundedErrorType = StellarAccountNotFundedError & {
	name: "StellarAccountNotFundedError";
};

export class StellarAccountNotFundedError extends BaseError {
	constructor(public account: string) {
		super("Stellar account is not funded.", {
			metaMessages: [`Account: ${account}`],
			name: "StellarAccountNotFundedError",
			details: `Account ${account} does not exist on the Stellar network, so it is not funded. The account must be created and funded with the minimum balance before it can receive tokens.`,
		});
	}
}

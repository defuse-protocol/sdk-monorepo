import { BaseError } from "../../errors/base";

export type StellarAccountNotFoundErrorType = StellarAccountNotFoundError & {
	name: "StellarAccountNotFoundError";
};

export class StellarAccountNotFoundError extends BaseError {
	constructor(public account: string) {
		super("Stellar account is not found.", {
			metaMessages: [`Account: ${account}`],
			name: "StellarAccountNotFoundError",
			details: `Account ${account} was not found on the Stellar network. The account must be created and funded with the minimum balance before it can receive tokens.`,
		});
	}
}

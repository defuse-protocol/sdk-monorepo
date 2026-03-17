import { BaseError } from "../../errors/base";

type XrplApiErrorOutput = {
	error: string;
	error_code: number;
	error_message: string;
};

export type XrplApiErrorType = XrplApiError & {
	name: "XrplApiError";
};

export class XrplApiError extends BaseError {
	constructor(public output: XrplApiErrorOutput) {
		super("XRPL API request failed.", {
			metaMessages: [
				`Error: ${output.error}`,
				`Error code: ${output.error_code}`,
			],
			name: "XrplApiError",
			details: output.error_message,
		});
	}
}

export type XrplAccountNotFundedErrorType = XrplAccountNotFundedError & {
	name: "XrplAccountNotFundedError";
};

export class XrplAccountNotFundedError extends BaseError {
	constructor(public account: string) {
		super("XRPL account is not funded.", {
			metaMessages: [`Account: ${account}`],
			name: "XrplAccountNotFundedError",
			details: `Account ${account} was not found on the XRPL ledger. The account must be funded with the minimum reserve before it can receive tokens.`,
		});
	}
}

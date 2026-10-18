import { BaseError } from "@defuse-protocol/internal-utils";

export type XrplDestinationTagRequiredErrorType =
	XrplDestinationTagRequiredError & {
		name: "XrplDestinationTagRequiredError";
	};

export class XrplDestinationTagRequiredError extends BaseError {
	constructor(public destinationAddress: string) {
		super(
			"Destination address only accepts transfers with a destination tag.",
			{
				metaMessages: [`Destination address: ${destinationAddress}`],
				name: "XrplDestinationTagRequiredError",
				details: `Address ${destinationAddress} has the RequireDestTag flag set and cannot receive transfers without a destination tag.`,
			},
		);
	}
}

export type XrplInvalidDestinationTagErrorType =
	XrplInvalidDestinationTagError & {
		name: "XrplInvalidDestinationTagError";
	};

export class XrplInvalidDestinationTagError extends BaseError {
	constructor(public destinationTag: string) {
		super("Destination tag must be a whole number from 0 to 4294967295.", {
			metaMessages: [`Destination tag: ${JSON.stringify(destinationTag)}`],
			name: "XrplInvalidDestinationTagError",
			details:
				"XRP Ledger destination tags are unsigned 32-bit integers, written as decimal digits only.",
		});
	}
}

export type XrplDepositAuthEnabledErrorType = XrplDepositAuthEnabledError & {
	name: "XrplDepositAuthEnabledError";
};

export class XrplDepositAuthEnabledError extends BaseError {
	constructor(public destinationAddress: string) {
		super(
			"Destination address has deposit authorization enabled and cannot receive payments from unauthorized senders.",
			{
				metaMessages: [`Destination address: ${destinationAddress}`],
				name: "XrplDepositAuthEnabledError",
				details: `Address ${destinationAddress} has the DepositAuth flag set and only accepts payments from preauthorized senders.`,
			},
		);
	}
}

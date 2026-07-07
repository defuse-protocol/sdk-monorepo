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

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

export type XrplTrustlineErrorType = XrplTrustlineError & {
	name: "XrplTrustlineError";
};

export class XrplTrustlineError extends BaseError {
	constructor(
		public destinationAddress: string,
		public currency: string,
		public issuer: string,
		public amount: bigint,
		public trustlineLimit?: bigint,
	) {
		const metaMessages = [
			`Destination address: ${destinationAddress}`,
			`Currency: ${currency}`,
			`Issuer: ${issuer}`,
			`Withdrawal amount: ${amount}`,
		];
		if (trustlineLimit !== undefined) {
			metaMessages.push(`Trustline limit: ${trustlineLimit}`);
		}
		super("Trustline not found or limit is below the withdrawal amount.", {
			metaMessages,
			name: "XrplTrustlineError",
			details:
				trustlineLimit !== undefined
					? `Address ${destinationAddress} trustline limit ${trustlineLimit} for ${currency}/${issuer} is below the withdrawal amount ${amount}.`
					: `Address ${destinationAddress} has no trustline for ${currency}/${issuer}.`,
		});
	}
}

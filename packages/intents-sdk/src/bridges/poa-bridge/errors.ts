import { BaseError } from "@defuse-protocol/internal-utils";

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

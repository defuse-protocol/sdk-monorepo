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

export type XrplIssuerGlobalFreezeErrorType = XrplIssuerGlobalFreezeError & {
	name: "XrplIssuerGlobalFreezeError";
};

export class XrplIssuerGlobalFreezeError extends BaseError {
	constructor(
		public issuer: string,
		public currency: string,
	) {
		super("Issuer has enabled Global Freeze for all trust lines.", {
			metaMessages: [`Issuer: ${issuer}`, `Currency: ${currency}`],
			name: "XrplIssuerGlobalFreezeError",
			details: `Issuer ${issuer} has enabled Global Freeze, suspending all transfers of ${currency}.`,
		});
	}
}

export type XrplTrustlineErrorType = XrplTrustlineError & {
	name: "XrplTrustlineError";
};

export class XrplTrustlineError extends BaseError {
	public destinationAddress: string;
	public currency: string;
	public issuer: string;
	public amount: bigint;
	public trustlineLimit?: bigint;
	public isFrozen?: boolean;
	public isPeerFrozen?: boolean;

	constructor({
		destinationAddress,
		currency,
		issuer,
		amount,
		trustlineLimit,
		isFrozen,
		isPeerFrozen,
	}: {
		destinationAddress: string;
		currency: string;
		issuer: string;
		amount: bigint;
		trustlineLimit?: bigint;
		isFrozen?: boolean;
		isPeerFrozen?: boolean;
	}) {
		const metaMessages = [
			`Destination address: ${destinationAddress}`,
			`Currency: ${currency}`,
			`Issuer: ${issuer}`,
			`Withdrawal amount: ${amount}`,
		];
		if (trustlineLimit !== undefined) {
			metaMessages.push(`Trustline limit: ${trustlineLimit}`);
		}
		if (isFrozen) {
			metaMessages.push("Frozen by destination: true");
		}
		if (isPeerFrozen) {
			metaMessages.push("Frozen by issuer: true");
		}

		let details: string;
		if (isFrozen) {
			details = `Address ${destinationAddress} has frozen the trustline for ${currency}/${issuer}.`;
		} else if (isPeerFrozen) {
			details = `Issuer ${issuer} has frozen the trustline for ${currency} on address ${destinationAddress}.`;
		} else if (trustlineLimit !== undefined) {
			details = `Address ${destinationAddress} trustline limit ${trustlineLimit} for ${currency}/${issuer} is below the withdrawal amount ${amount}.`;
		} else {
			details = `Address ${destinationAddress} has no trustline for ${currency}/${issuer}.`;
		}

		super(
			isFrozen || isPeerFrozen
				? "Trustline is frozen."
				: "Trustline not found or limit is below the withdrawal amount.",
			{ metaMessages, name: "XrplTrustlineError", details },
		);
		this.destinationAddress = destinationAddress;
		this.currency = currency;
		this.issuer = issuer;
		this.amount = amount;
		this.trustlineLimit = trustlineLimit;
		this.isFrozen = isFrozen;
		this.isPeerFrozen = isPeerFrozen;
	}
}

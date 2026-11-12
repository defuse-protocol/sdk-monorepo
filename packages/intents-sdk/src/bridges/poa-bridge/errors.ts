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

export type StellarTrustlineNotAuthorizedErrorType =
	StellarTrustlineNotAuthorizedError & {
		name: "StellarTrustlineNotAuthorizedError";
	};

export class StellarTrustlineNotAuthorizedError extends BaseError {
	constructor(
		public destinationAddress: string,
		public assetId: string,
	) {
		super("Destination trustline is not authorized by the asset issuer.", {
			details: `Address ${destinationAddress} has a trustline for this asset, but the issuer has not authorized it (is_authorized: false), so payments will be rejected.`,
			metaMessages: [
				`Asset ID: ${assetId}`,
				`Destination address: ${destinationAddress}`,
			],
			name: "StellarTrustlineNotAuthorizedError",
		});
	}
}

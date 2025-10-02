import { BaseError } from "@defuse-protocol/internal-utils";
import type { Chain } from "../../lib/caip2";

export type OmniTransferNotFoundErrorType = OmniTransferNotFoundError & {
	name: "OmniTransferNotFoundError";
};
export class OmniTransferNotFoundError extends BaseError {
	constructor(public txHash: string) {
		super("Omni transfer with given hash is not found in the relayer.", {
			metaMessages: [`OriginTxHash: ${txHash}`],
			name: "OmniTransferNotFoundError",
		});
	}
}

export type OmniTransferDestinationChainHashNotFoundErrorType =
	OmniTransferDestinationChainHashNotFoundError & {
		name: "OmniTransferDestinationChainHashNotFoundError";
	};
export class OmniTransferDestinationChainHashNotFoundError extends BaseError {
	constructor(
		public txHash: string,
		public destinationChain: string | undefined,
	) {
		super("Relayer did not return destination chain hash for a transfer.", {
			metaMessages: [
				`OriginTxHash: ${txHash}`,
				`DestinationChain: ${destinationChain}`,
			],
			name: "OmniTransferDestinationChainHashNotFoundError",
		});
	}
}

export type TokenNotFoundInDestinationChainErrorType =
	TokenNotFoundInDestinationChainError & {
		name: "TokenNotFoundInDestinationChainError";
	};
export class TokenNotFoundInDestinationChainError extends BaseError {
	constructor(
		public token: string,
		public destinationChain: Chain,
	) {
		super(
			`The token ${token} doesn't exist in destination chain ${destinationChain}`,
			{
				metaMessages: [
					`Token: ${token}`,
					`Destination Chain: ${destinationChain}`,
				],
				name: "TokenNotFoundInDestinationChainError",
			},
		);
	}
}

export type FailedToFetchFeeErrorType = FailedToFetchFeeError & {
	name: "FailedToFetchFeeError";
};
export class FailedToFetchFeeError extends BaseError {
	constructor(public token: string) {
		super(`Failed to fetch fee data for ${token}`, {
			metaMessages: [`Token: ${token}`],
			name: "FailedToFetchFeeError",
		});
	}
}

export type OmniTokenNormalisationCheckErrorType =
	OmniTokenNormalisationCheckError & {
		name: "OmniTokenNormalisationCheckError";
	};
export class OmniTokenNormalisationCheckError extends BaseError {
	constructor(
		public tokenIn: string,
		public destinationToken: string,
		public minAmount: bigint,
		public fee: bigint,
	) {
		super(`Transfer too small — normalizes to 0.`, {
			metaMessages: [
				`TokenIn: ${tokenIn}`,
				`DestinationToken: ${destinationToken}`,
				`MinAmount: ${minAmount}`,
				`fee: ${fee}`,
			],
			name: "OmniTokenNormalisationCheckError",
			details: `Transfer amount sent to relayer is too small - would result in 0 after decimal normalisation. Minimum transferable amount if feeInclusive=false is >= ${minAmount}. Minimum transferable amount if feeInclusive=true is >= ${minAmount + fee}.`,
		});
	}
}

export type IntentsNearOmniAvailableBalanceTooLowErrorType =
	IntentsNearOmniAvailableBalanceTooLowError & {
		name: "IntentsNearOmniAvailableBalanceTooLowError";
	};
export class IntentsNearOmniAvailableBalanceTooLowError extends BaseError {
	constructor(public balance: string) {
		super(
			`Omni storage balance of intents contract is too low to complete this transaction safely.`,
			{
				metaMessages: [`Balance: ${balance}`],
				name: "IntentsNearOmniAvailableBalanceTooLowError",
				details: `The available Omni storage balance for intents contract is ${balance}, which is too low to complete this transaction safely. The balance needs to be topped up before retrying.`,
			},
		);
	}
}

export type IntentsNearOmniAvailableBalanceTooLowErrorType =
	IntentsNearOmniAvailableBalanceTooLowError & {
		name: "IntentsNearOmniAvailableBalanceTooLowError";
	};
export class IntentsNearOmniAvailableBalanceTooLowError extends BaseError {
	constructor(public balance: string) {
		super(
			`The available Omni storage balance for intents.near is ${balance}, which is too low to complete this transaction safely. The balance needs to be topped up before retrying.`,
			{
				metaMessages: [`Balance: ${balance}`],
				name: "IntentsNearOmniAvailableBalanceTooLowError",
			},
		);
	}
}

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

export type InvalidFeeValueErrorType = InvalidFeeValueError & {
	name: "InvalidFeeValueError";
};
export class InvalidFeeValueError extends BaseError {
	constructor(
		public token: string,
		value: unknown,
	) {
		super(`Invalid fee value`, {
			metaMessages: [`Token: ${token}`, `Fee value: ${value}`],
			name: "InvalidFeeValueError",
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

export type InsufficientUtxoForOmniBridgeWithdrawalErrorType =
	InsufficientUtxoForOmniBridgeWithdrawalError & {
		name: "InsufficientUtxoForOmniBridgeWithdrawalError";
	};
export class InsufficientUtxoForOmniBridgeWithdrawalError extends BaseError {
	constructor(public destinationChain: Chain) {
		super("Insufficient utxo for withdrawal to a utxo chain.", {
			metaMessages: [`Destination Chain: ${destinationChain}`],
			name: "InsufficientUtxoForOmniBridgeWithdrawalError",
		});
	}
}

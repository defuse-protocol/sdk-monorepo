import { BaseError } from "@defuse-protocol/internal-utils";

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

export type OmniTransferNotSupportedDestinationChainErrorType =
	OmniTransferNotSupportedDestinationChainError & {
		name: "OmniTransferNotSupportedDestinationChainError";
	};
export class OmniTransferNotSupportedDestinationChainError extends BaseError {
	constructor(
		public txHash: string,
		public destinationChain: string | undefined,
	) {
		super(
			"Attempt to process omni transfer with unsupported destination chain.",
			{
				metaMessages: [
					`OriginTxHash: ${txHash}`,
					`DestinationChain: ${destinationChain}`,
				],
				name: "OmniTransferNotSupportedDestinationChainError",
			},
		);
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

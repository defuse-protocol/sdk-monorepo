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
		destinationChain: Chain,
	) {
		super(
			`The token ${token} doesn't exist in destination network ${destinationChain}`,
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

export type TokenNotSupportedByOmniRelayerErrorType =
	TokenNotSupportedByOmniRelayerError & {
		name: "TokenNotSupportedByOmniRelayerError";
	};
export class TokenNotSupportedByOmniRelayerError extends BaseError {
	constructor(public token: string) {
		super(`Omni Relayer doesn't accept fee in the transferred token ${token}`, {
			metaMessages: [`Token: ${token}`],
			name: "TokenNotSupportedByOmniRelayerError",
		});
	}
}

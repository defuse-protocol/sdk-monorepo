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
export type TokenNotFoundInDestinationChainErrorType =
	TokenNotFoundInDestinationChainError & {
		name: "TokenNotFoundInDestinationChainError";
	};
export class TokenNotFoundInDestinationChainError extends BaseError {
	constructor(
		public token: string,
		chainKind: Chain,
	) {
		super(
			`The token ${token} doesn't exist in destination network ${chainKind}`,
			{
				metaMessages: [`Token: ${token}`, `Destination Chain: ${chainKind}`],
				name: "TokenNotFoundInDestinationChainError",
			},
		);
	}
}

export type UnsupportedChainErrorType = UnsupportedChainError & {
	name: "UnsupportedOmniNetworkError";
};
export class UnsupportedChainError extends BaseError {
	constructor(chainKind: Chain) {
		super(`Chain is not supported by the omni bridge ${chainKind}`, {
			metaMessages: [`Chain: ${chainKind}`],
			name: "UnsupportedChain",
		});
	}
}

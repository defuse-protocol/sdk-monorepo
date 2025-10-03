import { BaseError } from "@defuse-protocol/internal-utils";
import type { FeeEstimation } from "../shared-types";

export type FeeExceedsAmountErrorType = FeeExceedsAmountError & {
	name: "FeeExceedsAmountError";
};

export class FeeExceedsAmountError extends BaseError {
	constructor(
		public feeEstimation: FeeEstimation,
		public amount: bigint,
	) {
		super("Amount too small to pay fee.", {
			metaMessages: [
				`Required fee: ${feeEstimation.amount}`,
				`Withdrawal amount: ${amount}`,
			],
			name: "FeeExceedsAmountError",
		});
	}
}

export type MinWithdrawalAmountErrorType = MinWithdrawalAmountError & {
	name: "MinWithdrawalAmountError";
};

export class MinWithdrawalAmountError extends BaseError {
	constructor(
		public minAmount: bigint,
		public requestedAmount: bigint,
		public assetId: string,
	) {
		super("Withdrawal amount is below minimum required by the bridge.", {
			metaMessages: [
				`Asset ID: ${assetId}`,
				`Minimum amount: ${minAmount}`,
				`Requested amount: ${requestedAmount}`,
			],
			name: "MinWithdrawalAmountError",
		});
	}
}

export type UnsupportedDestinationMemoErrorType =
	UnsupportedDestinationMemoError & {
		name: "UnsupportedDestinationMemoError";
	};

export class UnsupportedDestinationMemoError extends BaseError {
	constructor(
		public blockchain: string,
		public assetId: string,
	) {
		super("Destination memo is not supported for this blockchain.", {
			details: "Destination memo is only supported for XRP Ledger withdrawals.",
			metaMessages: [`Blockchain: ${blockchain}`, `Asset ID: ${assetId}`],
			name: "UnsupportedDestinationMemoError",
		});
	}
}

export type TrustlineNotFoundErrorType = TrustlineNotFoundError & {
	name: "TrustlineNotFoundError";
};

export class TrustlineNotFoundError extends BaseError {
	constructor(
		public destinationAddress: string,
		public assetId: string,
		public blockchain: string,
		public tokenAddress: string,
	) {
		super("Destination address does not have a trustline for this asset.", {
			details:
				"The destination address must establish a trustline before receiving this asset.",
			metaMessages: [
				`Blockchain: ${blockchain}`,
				`Asset ID: ${assetId}`,
				`Destination address: ${destinationAddress}`,
				`Token address: ${tokenAddress}`,
			],
			name: "TrustlineNotFoundError",
		});
	}
}

export type UnsupportedAssetIdErrorType = UnsupportedAssetIdError & {
	name: "UnsupportedAssetIdError";
};

export class UnsupportedAssetIdError extends BaseError {
	constructor(
		public assetId: string,
		details: string,
	) {
		super("Asset ID is not supported.", {
			details,
			metaMessages: [`Asset ID: ${assetId}`],
			name: "UnsupportedAssetIdError",
		});
	}
}

export type InvalidDestinationAddressForWithdrawalErrorType =
	InvalidDestinationAddressForWithdrawalError & {
		name: "InvalidDestinationAddressForWithdrawalError";
	};

export class InvalidDestinationAddressForWithdrawalError extends BaseError {
	constructor(
		public destinationAddress: string,
		public bridgeName: string,
		public chainName: string,
	) {
		super(
			`Destination address ${destinationAddress} is not valid for withdrawal to ${chainName} using ${bridgeName}.`,
			{
				metaMessages: [
					`Destination address: ${destinationAddress}`,
					`Bridge: ${bridgeName}`,
					`Chain: ${chainName}`,
				],
				name: "InvalidDestinationAddressForWithdrawalError",
			},
		);
	}
}

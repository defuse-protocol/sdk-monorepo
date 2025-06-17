import type { Quote } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/solverRelayHttpClient/types";
import type { IIntentSigner } from "./intents/interfaces/intent-signer.ts";
import type { IntentPrimitive } from "./intents/shared-types.ts";
import type { CAIP2_NETWORK } from "./lib/caip2.ts";

export interface IBridgeSDK {
	setIntentSigner(signer: IIntentSigner): void;

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]>;

	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation>;

	waitForWithdrawalCompletion(args: {
		bridge: BridgeKind;
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo | TxNoInfo>;

	parseAssetId(assetId: string): ParsedAssetInfo;
}

export interface NearTxInfo {
	hash: string;
	accountId: string;
}

export interface TxInfo {
	hash: string;
}

export interface TxNoInfo {
	hash: null;
}

export type BridgeKind = "direct" | "poa" | "hot";

export interface WithdrawalParams {
	assetId: string;
	amount: bigint;
	destinationAddress: string;
	destinationMemo: string | undefined;
	feeInclusive: boolean;
}

export interface FeeEstimation {
	amount: bigint;
	quote: null | Quote;
}

export interface Bridge {
	supports(params: { assetId: string } | { bridge: BridgeKind }): boolean;
	parseAssetId(assetId: string): ParsedAssetInfo | null;
	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation>;
	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]>;
	waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo | TxNoInfo>;
}

export interface SingleWithdrawal<Ticket> {
	estimateFee(): Promise<bigint>;
	signAndSendIntent(): Promise<Ticket>;
	waitForIntentSettlement(): Promise<NearTxInfo>;
	waitForWithdrawalCompletion(): Promise<TxInfo | TxNoInfo>;
	process(): Promise<void>;
}

export interface BatchWithdrawal<Ticket> {
	estimateFee(): Promise<PromiseSettledResult<bigint>[]>;
	removeUnprocessableWithdrawals(): void;
	signAndSendIntent(): Promise<Ticket>;
	waitForIntentSettlement(): Promise<NearTxInfo>;
	waitForWithdrawalCompletion(): Promise<
		PromiseSettledResult<TxInfo | TxNoInfo>[]
	>;
	process(): Promise<void>;
}

export interface WithdrawalIdentifier {
	bridge: BridgeKind;
	index: number;
	tx: NearTxInfo;
}

export type ParsedAssetInfo = (
	| {
			blockchain: CAIP2_NETWORK;
			bridge: BridgeKind;
			standard: "nep141";
			contractId: string;
	  }
	| {
			blockchain: CAIP2_NETWORK;
			bridge: BridgeKind;
			standard: "nep245";
			contractId: string;
			tokenId: string;
	  }
) &
	({ native: true } | { address: string });

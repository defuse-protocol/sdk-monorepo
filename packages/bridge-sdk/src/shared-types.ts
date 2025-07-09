import type {
	RetryOptions,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type { IntentPrimitive } from "./intents/shared-types";
import type { CAIP2_NETWORK } from "./lib/caip2";

export interface IBridgeSDK {
	setIntentSigner(signer: IIntentSigner): void;

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]>;

	estimateWithdrawalFee<
		T extends Pick<
			WithdrawalParams,
			| "assetId"
			| "destinationAddress"
			| "bridgeConfig"
			| "feeInclusive"
			| "amount"
		>,
	>(args: {
		withdrawalParams: T;
	}): Promise<FeeEstimation>;

	waitForWithdrawalCompletion(args: {
		bridge: BridgeConfig;
		tx: NearTxInfo;
		index: number;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
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

export type BridgeKind = "direct" | "poa" | "hot" | "aurora_engine" | "intents";

export interface WithdrawalParams {
	assetId: string;
	amount: bigint;
	destinationAddress: string;
	destinationMemo: string | undefined;
	feeInclusive: boolean;
	bridgeConfig?: BridgeConfig;
}

export type BridgeConfig =
	| {
			bridge: Exclude<BridgeKind, "aurora_engine" | "intents">;
			chain: CAIP2_NETWORK;
	  }
	| {
			bridge: "aurora_engine";
			auroraEngineContractId: string;
			proxyTokenContractId: string | null;
	  }
	| { bridge: "intents" };

export interface FeeEstimation {
	amount: bigint;
	quote: null | solverRelay.Quote;
}

export interface Bridge {
	is(bridgeConfig: BridgeConfig): boolean;
	supports(params: Pick<WithdrawalParams, "assetId" | "bridgeConfig">): boolean;
	parseAssetId(assetId: string): ParsedAssetInfo | null;
	estimateWithdrawalFee<
		T extends Pick<
			WithdrawalParams,
			"assetId" | "destinationAddress" | "bridgeConfig"
		>,
	>(args: {
		withdrawalParams: T;
	}): Promise<FeeEstimation>;
	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]>;
	waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		bridge: BridgeConfig;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	}): Promise<TxInfo | TxNoInfo>;
}

export interface SingleWithdrawal<Ticket> {
	estimateFee(): Promise<bigint>;
	signAndSendIntent(): Promise<Ticket>;
	waitForIntentSettlement(): Promise<NearTxInfo>;
	waitForWithdrawalCompletion(args?: {
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	}): Promise<TxInfo | TxNoInfo>;
	process(): Promise<void>;
}

export interface BatchWithdrawal<Ticket> {
	estimateFee(): Promise<PromiseSettledResult<bigint>[]>;
	removeUnprocessableWithdrawals(): void;
	signAndSendIntent(): Promise<Ticket>;
	waitForIntentSettlement(): Promise<NearTxInfo>;
	waitForWithdrawalCompletion(args?: {
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	}): Promise<PromiseSettledResult<TxInfo | TxNoInfo>[]>;
	process(): Promise<void>;
}

export interface WithdrawalIdentifier {
	bridge: BridgeConfig;
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

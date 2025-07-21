import type {
	ILogger,
	RetryOptions,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { RouteEnum, RouteEnumValues } from "./constants/route-enum";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type { IntentPrimitive } from "./intents/shared-types";
import type { CAIP2_NETWORK } from "./lib/caip2";

export interface IBridgeSDK {
	setIntentSigner(signer: IIntentSigner): void;

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
		logger?: ILogger;
	}): Promise<IntentPrimitive[]>;

	estimateWithdrawalFee<
		T extends Pick<
			WithdrawalParams,
			| "assetId"
			| "destinationAddress"
			| "routeConfig"
			| "feeInclusive"
			| "amount"
		>,
	>(args: {
		withdrawalParams: T;
		quoteOptions?: { waitMs: number };
	}): Promise<FeeEstimation>;

	waitForWithdrawalCompletion(args: {
		routeConfig: RouteConfig;
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

export interface WithdrawalParams {
	assetId: string;
	amount: bigint;
	destinationAddress: string;
	destinationMemo: string | undefined;
	feeInclusive: boolean;
	routeConfig?: RouteConfig | undefined;
}

export type NearWithdrawalRouteConfig = {
	route: RouteEnum["NearWithdrawal"];
	msg?: string;
};

export type InternalTransferRouteConfig = {
	route: RouteEnum["InternalTransfer"];
};

export type VirtualChainRouteConfig = {
	route: RouteEnum["VirtualChain"];
	auroraEngineContractId: string;
	proxyTokenContractId: string | null;
};

export type PoaBridgeRouteConfig = {
	route: RouteEnum["PoaBridge"];
	chain: CAIP2_NETWORK;
};

export type HotBridgeRouteConfig = {
	route: RouteEnum["HotBridge"];
	chain: CAIP2_NETWORK;
};

export type RouteConfig =
	| NearWithdrawalRouteConfig
	| InternalTransferRouteConfig
	| VirtualChainRouteConfig
	| PoaBridgeRouteConfig
	| HotBridgeRouteConfig;

export interface FeeEstimation {
	amount: bigint;
	quote: null | solverRelay.Quote;
}

export interface Bridge {
	is(routeConfig: RouteConfig): boolean;
	supports(params: Pick<WithdrawalParams, "assetId" | "routeConfig">): boolean;
	parseAssetId(assetId: string): ParsedAssetInfo | null;

	/**
	 * Validates minimum withdrawal amount for the bridge.
	 * Each bridge implementation may have different minimum withdrawal requirements.
	 * Some bridges (like Aurora Engine, Intents) have no restrictions and will always pass.
	 * Others (like POA) check against their API for token-specific minimum amounts.
	 * @throws {MinWithdrawalAmountError} If the amount is below the minimum required
	 */
	validateMinWithdrawalAmount(args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void>;

	estimateWithdrawalFee<
		T extends Pick<
			WithdrawalParams,
			"assetId" | "destinationAddress" | "routeConfig"
		>,
	>(args: {
		withdrawalParams: T;
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation>;
	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]>;
	waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		routeConfig: RouteConfig;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
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
	routeConfig: RouteConfig;
	index: number;
	tx: NearTxInfo;
}

export type ParsedAssetInfo = (
	| {
			blockchain: CAIP2_NETWORK;
			route: RouteEnumValues;
			standard: "nep141";
			contractId: string;
	  }
	| {
			blockchain: CAIP2_NETWORK;
			route: RouteEnumValues;
			standard: "nep245";
			contractId: string;
			tokenId: string;
	  }
) &
	({ native: true } | { address: string });

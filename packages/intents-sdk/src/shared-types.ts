import type {
	ILogger,
	RetryOptions,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { HotBridgeEVMChain } from "./bridges/hot-bridge/hot-bridge-chains";
import type { BridgeNameEnumValues } from "./constants/bridge-name-enum";
import type { RouteEnum } from "./constants/route-enum";
import type { OnBeforePublishIntentHook } from "./intents/intent-executer-impl/intent-executer";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type {
	IntentHash,
	IntentPayloadFactory,
	IntentPrimitive,
	IntentRelayParamsFactory,
	MultiPayload,
} from "./intents/shared-types";
import type { Chain, Chains } from "./lib/caip2";

export interface IntentPublishResult {
	intentHash: IntentHash;
}

export interface WithdrawalResult {
	feeEstimation: FeeEstimation;
	intentHash: IntentHash;
	intentTx: NearTxInfo;
	destinationTx: TxInfo | TxNoInfo;
}

export interface BatchWithdrawalResult {
	feeEstimation: FeeEstimation[];
	intentHash: IntentHash;
	intentTx: NearTxInfo;
	destinationTx: (TxInfo | TxNoInfo)[];
}

export type IntentSettlementStatus = solverRelay.GetStatusReturnType;

/**
 * Configuration for composing multiple intents into an atomic batch.
 *
 * Intents can be attached in two ways:
 * - `prepend`: Pre-signed intents that will be added before the new intents
 * - `append`: Pre-signed intents that will be added after the new intents
 *
 * The order matters for transaction execution on-chain.
 *
 * @example
 * ```typescript
 * // Attach pre-signed intents from other users
 * const composition: IntentComposition = {
 *   prepend: [signedIntent1, signedIntent2],
 * };
 *
 * await sdk.signAndSendIntent({
 *   intents: [myNewIntent],
 *   composition,
 * });
 * ```
 */
export interface IntentComposition {
	/**
	 * Pre-signed intents (MultiPayload) to execute before the new intents.
	 * Useful for dependencies that must be executed first.
	 */
	prepend?: MultiPayload[];

	/**
	 * Pre-signed intents (MultiPayload) to execute after the new intents.
	 * Useful for cleanup or follow-up actions.
	 */
	append?: MultiPayload[];
}

export interface SignAndSendArgs {
	intents: IntentPrimitive[];
	payload?: IntentPayloadFactory;
	relayParams?: IntentRelayParamsFactory;
	signer?: IIntentSigner;
	onBeforePublishIntent?: OnBeforePublishIntentHook;
	logger?: ILogger;
	/**
	 * Compose this intent with other pre-signed intents for atomic execution.
	 * All intents will be executed together or not at all.
	 */
	composition?: IntentComposition;
}

export type SignAndSendWithdrawalArgs<
	T extends WithdrawalParams | WithdrawalParams[],
> = {
	withdrawalParams: T;
	feeEstimation: T extends WithdrawalParams[] ? FeeEstimation[] : FeeEstimation;
	referral?: string;
	intent?: Omit<SignAndSendArgs, "logger" | "intents">;
	logger?: ILogger;
};

export type ProcessWithdrawalArgs<
	T extends WithdrawalParams | WithdrawalParams[],
> = {
	withdrawalParams: T;
	feeEstimation?: T extends WithdrawalParams[]
		? FeeEstimation[]
		: FeeEstimation;
	intent?: {
		payload?: IntentPayloadFactory;
		relayParams?: IntentRelayParamsFactory;
		signer?: IIntentSigner;
		onBeforePublishIntent?: OnBeforePublishIntentHook;
		/**
		 * Compose this withdrawal intent with other pre-signed intents for atomic execution.
		 * All intents will be executed together or not at all.
		 */
		composition?: IntentComposition;
	};
	referral?: string;
	retryOptions?: RetryOptions;
	logger?: ILogger;
};

export interface IIntentsSDK {
	setIntentSigner(signer: IIntentSigner): void;

	signAndSendIntent(args: SignAndSendArgs): Promise<IntentPublishResult>;

	waitForIntentSettlement(args: {
		intentHash: IntentHash;
		logger?: ILogger;
	}): Promise<NearTxInfo>;

	getIntentStatus(args: {
		intentHash: IntentHash;
		logger?: ILogger;
	}): Promise<IntentSettlementStatus>;

	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation>;

	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams[];
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation[]>;

	signAndSendWithdrawalIntent(
		args:
			| SignAndSendWithdrawalArgs<WithdrawalParams>
			| SignAndSendWithdrawalArgs<WithdrawalParams[]>,
	): Promise<IntentPublishResult>;

	waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams;
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<TxInfo | TxNoInfo>;

	waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams[];
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<Array<TxInfo | TxNoInfo>>;

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
		logger?: ILogger;
	}): Promise<IntentPrimitive[]>;

	parseAssetId(assetId: string): ParsedAssetInfo;

	// Orchestrated functions for convenience
	processWithdrawal(
		args: ProcessWithdrawalArgs<WithdrawalParams>,
	): Promise<WithdrawalResult>;

	processWithdrawal(
		args: ProcessWithdrawalArgs<WithdrawalParams[]>,
	): Promise<BatchWithdrawalResult>;
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
	/**
	 * XRP Leger chain specific. MEMO IS NOT SUPPORTED FOR STELLAR AND TON.
	 */
	destinationMemo?: string | undefined;
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
	chain: Chain;
};

export type HotBridgeRouteConfig = {
	route: RouteEnum["HotBridge"];
	chain: Chain;
};

export type OmniBridgeRouteConfig = {
	route: RouteEnum["OmniBridge"];
	chain?: Chain;
};

export type RouteConfig =
	| NearWithdrawalRouteConfig
	| InternalTransferRouteConfig
	| VirtualChainRouteConfig
	| PoaBridgeRouteConfig
	| HotBridgeRouteConfig
	| OmniBridgeRouteConfig;

export interface FeeEstimation {
	amount: bigint;
	quote: null | solverRelay.Quote;
}

export interface Bridge {
	is(routeConfig: RouteConfig): boolean;
	supports(
		params: Pick<WithdrawalParams, "assetId" | "routeConfig">,
	): Promise<boolean>;
	parseAssetId(assetId: string): ParsedAssetInfo | null;

	/**
	 * Validates withdrawal constraints for the bridge.
	 * Each bridge implementation may have different withdrawal requirements.
	 * Some bridges (like Aurora Engine, Intents) have no restrictions and will always pass.
	 * Others (like POA) check minimum amounts, and HOT Bridge checks trustlines for Stellar.
	 * @throws {MinWithdrawalAmountError} If the amount is below the minimum required
	 * @throws {TrustlineNotFoundError} If destination address lacks required trustline
	 */
	validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		feeEstimation: FeeEstimation;
		routeConfig?: RouteConfig;
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

export interface WithdrawalIdentifier {
	routeConfig: RouteConfig;
	index: number;
	tx: NearTxInfo;
}

export type ParsedAssetInfo = (
	| {
			blockchain: Chain;
			bridgeName: BridgeNameEnumValues;
			standard: "nep141";
			contractId: string;
	  }
	| {
			blockchain: Chain;
			bridgeName: BridgeNameEnumValues;
			standard: "nep245";
			contractId: string;
			tokenId: string;
	  }
) &
	({ native: true } | { address: string });

export type RPCEndpointMap = Record<
	typeof Chains.Near | HotBridgeEVMChain,
	string[]
> & {
	[K in typeof Chains.Stellar]: {
		soroban: string[];
		horizon: string[];
	};
};

type DeepPartial<T> = T extends object
	? T extends Array<infer U>
		? Array<DeepPartial<U>>
		: // biome-ignore lint/complexity/noBannedTypes: <explanation>
			T extends Function
			? T
			: { [P in keyof T]?: DeepPartial<T[P]> }
	: T;

export type PartialRPCEndpointMap = DeepPartial<RPCEndpointMap>;

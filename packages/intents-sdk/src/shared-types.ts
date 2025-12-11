import type {
	ILogger,
	RetryOptions,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { HotBridgeEVMChain } from "./bridges/hot-bridge/hot-bridge-chains";
import type { BridgeNameEnumValues } from "./constants/bridge-name-enum";
import { RouteEnum, type RouteEnumValues } from "./constants/route-enum";
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
 * Configuration for including pre-signed intents to be published atomically.
 *
 * Pre-signed intents can be included in two ways:
 * - `before`: Pre-signed intents that execute before the newly created intent
 * - `after`: Pre-signed intents that execute after the newly created intent
 *
 * The execution order is guaranteed: before → new intent → after
 *
 * @example
 * ```typescript
 * // Include pre-signed intents from other users
 * const signedIntents: SignedIntents = {
 *   before: [signedIntent1, signedIntent2],
 *   after: [cleanupIntent],
 * };
 *
 * await sdk.signAndSendIntent({
 *   intents: [myNewIntent],
 *   signedIntents,
 * });
 * ```
 */
export interface SignedIntentsComposition {
	/**
	 * Pre-signed intents (MultiPayload) to execute before the newly created intent.
	 * Useful for dependencies that must be executed first.
	 */
	before?: MultiPayload[];

	/**
	 * Pre-signed intents (MultiPayload) to execute after the newly created intent.
	 * Useful for cleanup or follow-up actions.
	 */
	after?: MultiPayload[];
}

export interface SignAndSendArgs {
	intents: IntentPrimitive[];
	/**
	 * Factory function to modify the intent payload draft before signing.
	 * Use this to add or modify intent primitives in the payload.
	 *
	 * @example
	 * ```typescript
	 * payload: (draft) => ({
	 *   intents: [...draft.intents, { intent: "transfer", ... }]
	 * })
	 * ```
	 */
	payload?: IntentPayloadFactory;
	relayParams?: IntentRelayParamsFactory;
	signer?: IIntentSigner;
	onBeforePublishIntent?: OnBeforePublishIntentHook;
	/**
	 * Pre-signed intents for atomic execution.
	 * The newly created intent will be published together with these pre-signed intents.
	 */
	signedIntents?: SignedIntentsComposition;
	logger?: ILogger;
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
		/** @see SignAndSendArgs.payload */
		payload?: IntentPayloadFactory;
		/** @see SignAndSendArgs.relayParams */
		relayParams?: IntentRelayParamsFactory;
		/** @see SignAndSendArgs.signer */
		signer?: IIntentSigner;
		/** @see SignAndSendArgs.onBeforePublishIntent */
		onBeforePublishIntent?: OnBeforePublishIntentHook;
		/** @see SignAndSendArgs.signedIntents */
		signedIntents?: SignedIntentsComposition;
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

	invalidateNonces(args: {
		nonces: string[];
		signer?: IIntentSigner;
		logger?: ILogger;
	}): Promise<void>;

	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation>;

	estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams[];
		quoteOptions?: QuoteOptions;
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

export interface QuoteOptions {
	waitMs?: number;
	minWaitMs?: number;
	maxWaitMs?: number;
	trustedMetadata?: unknown;
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

/**
 * Fee structure definitions for each route type.
 */
export interface RouteFeeStructures {
	[RouteEnum.HotBridge]: {
		/** Relayer fee for processing the withdrawal on destination chain, taken in base token of destination chain. */
		relayerFee: bigint;
		/** Block number at the time of fee estimation, required for building gasless withdraw intent. */
		blockNumber: bigint;
	};

	[RouteEnum.PoaBridge]: {
		/** Relayer fee for POA bridge transfers, taken in transferred token. */
		relayerFee: bigint;
	};

	[RouteEnum.NearWithdrawal]: {
		/** Fee for nep141 storage deposit in NEAR blockchain, taken in wrap.near token. Paid for a token recipient. */
		storageDepositFee: bigint;
	};

	[RouteEnum.OmniBridge]: {
		/** Fee for nep141 storage deposit in NEAR blockchain, taken in wrap.near token. Paid for omni bridge contract. */
		storageDepositFee: bigint;
		/** Relayer fee for transferring tokens via Omni Bridge to other supported blockchains, taken in wrap.near token. */
		relayerFee: bigint;
		/** Fee taken when making a withdrawal via UTXO connector (e.g., btc-connector.bridge.near), taken in transferred token. */
		utxoProtocolFee?: bigint;
		/** Maximum amount of tokens that can be spent on gas when making a withdrawal via UTXO connector (e.g., btc-connector.bridge.near), taken in transferred token. */
		utxoMaxGasFee?: bigint;
	};

	[RouteEnum.VirtualChain]: {
		/** Fee for nep141 storage deposit in NEAR blockchain, taken in wrap.near token. Paid for virtual chain contract */
		storageDepositFee: bigint;
	};

	/** Internal transfers have no fees */
	[RouteEnum.InternalTransfer]: null;
}

/**
 * Represents the different categories of fees that may apply across various withdrawal operations.
 * Each route type has an optional fee structure. Uses a mapped type to ensure all RouteEnum values are covered.
 */
export type UnderlyingFees = {
	[K in RouteEnumValues]?: RouteFeeStructures[K];
};

export interface FeeEstimation {
	amount: bigint;
	/**
	 * @internal Implementation detail - do not use directly.
	 * This field may change or be removed without notice.
	 */
	quote: null | solverRelay.Quote;
	/**
	 * @internal Implementation detail - do not use directly.
	 * This field may change or be removed without notice.
	 */
	underlyingFees: UnderlyingFees;
}

export interface Bridge {
	readonly route: RouteEnumValues;

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
			"assetId" | "destinationAddress" | "routeConfig" | "amount"
		>,
	>(args: {
		withdrawalParams: T;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation>;
	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]>;

	/**
	 * Creates a complete withdrawal identifier with all required info.
	 * Derives landingChain from withdrawalParams.routeConfig.chain if available, otherwise from assetId.
	 */
	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier;

	/**
	 * One-shot status check for a withdrawal.
	 * Returns the current status without polling.
	 */
	describeWithdrawal(
		args: WithdrawalIdentifier & { logger?: ILogger },
	): Promise<WithdrawalStatus>;
}

export interface WithdrawalIdentifier {
	/** Actual chain where funds arrive; Near for virtual/internal routes */
	landingChain: Chain;
	/** Per-bridge withdrawal sequence number */
	index: number;
	withdrawalParams: WithdrawalParams;
	tx: NearTxInfo;
}

export type WithdrawalStatus =
	| { status: "pending" }
	| { status: "completed"; txHash: string | null }
	| { status: "failed"; reason: string };

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

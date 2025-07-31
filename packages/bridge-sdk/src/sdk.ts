import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	PUBLIC_NEAR_RPC_URLS,
	type RetryOptions,
	nearFailoverRpcProvider,
} from "@defuse-protocol/internal-utils";
import hotOmniSdk from "@hot-labs/omni-sdk";
import { stringify } from "viem";
import { AuroraEngineBridge } from "./bridges/aurora-engine-bridge/aurora-engine-bridge";
import { DirectBridge } from "./bridges/direct-bridge/direct-bridge";
import { HotBridge } from "./bridges/hot-bridge/hot-bridge";
import { HotBridgeEVMChains } from "./bridges/hot-bridge/hot-bridge-chains";
import { IntentsBridge } from "./bridges/intents-bridge/intents-bridge";
import { PoaBridge } from "./bridges/poa-bridge/poa-bridge";
import { BatchWithdrawalImpl } from "./classes/batch-withdrawal";
import { FeeExceedsAmountError } from "./classes/errors";
import { SingleWithdrawalImpl } from "./classes/single-withdrawal";
import {
	PUBLIC_EVM_RPC_URLS,
	PUBLIC_STELLAR_RPC_URLS,
} from "./constants/public-rpc-urls";
import {
	IntentExecuter,
	type OnBeforePublishIntentHook,
} from "./intents/intent-executer-impl/intent-executer";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import type { IIntentRelayer } from "./intents/interfaces/intent-relayer";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type {
	IntentHash,
	IntentPayloadFactory,
	IntentPrimitive,
	IntentRelayParamsFactory,
} from "./intents/shared-types";
import { Chains } from "./lib/caip2";
import {
	configureEvmRpcUrls,
	configureStellarRpcUrls,
} from "./lib/configure-rpc-config";
import type {
	Bridge,
	FeeEstimation,
	IBridgeSDK,
	NearTxInfo,
	ParsedAssetInfo,
	RPCEndpointMap,
	RouteConfig,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "./shared-types";

export interface BridgeSDKConfig {
	env?: NearIntentsEnv;
	intentSigner?: IIntentSigner;
	rpc?: Partial<RPCEndpointMap>;
	referral: string;
}

export class BridgeSDK implements IBridgeSDK {
	protected env: NearIntentsEnv;
	protected referral: string;
	protected intentRelayer: IIntentRelayer<IntentHash>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];

	constructor(args: BridgeSDKConfig) {
		this.env = args.env ?? "production";
		this.referral = args.referral;

		const nearRpcUrls = args.rpc?.[Chains.Near] ?? PUBLIC_NEAR_RPC_URLS;
		assert(nearRpcUrls.length > 0, "NEAR RPC URLs are not provided");
		const nearProvider = nearFailoverRpcProvider({ urls: nearRpcUrls });

		const stellarRpcUrls = configureStellarRpcUrls(
			PUBLIC_STELLAR_RPC_URLS,
			args.rpc,
		);

		const evmRpcUrls = configureEvmRpcUrls(
			PUBLIC_EVM_RPC_URLS,
			args.rpc,
			HotBridgeEVMChains,
		);

		/**
		 * Order of bridges matters, because the first bridge that supports the `withdrawalParams` will be used.
		 * More specific bridges should be placed before more generic ones.
		 */
		this.bridges = [
			new IntentsBridge(),
			new AuroraEngineBridge({
				env: this.env,
				nearProvider,
			}),
			new PoaBridge({ env: this.env }),
			new HotBridge({
				env: this.env,
				hotSdk: new hotOmniSdk.HotBridge({
					logger: console,
					evmRpc: evmRpcUrls,
					// 1. HotBridge from omni-sdk does not support FailoverProvider.
					// 2. omni-sdk has near-api-js@5.0.1, and it uses `instanceof` which doesn't work when multiple versions of packages are installed
					nearRpc: nearRpcUrls,
					stellarRpc: stellarRpcUrls.soroban,
					stellarHorizonRpc: stellarRpcUrls.horizon,
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			}),
			new DirectBridge({
				env: this.env,
				nearProvider,
			}),
		];

		this.intentRelayer = new IntentRelayerPublic({ env: this.env });

		this.intentSigner = args.intentSigner;
	}

	setIntentSigner(signer: IIntentSigner) {
		this.intentSigner = signer;
	}

	createWithdrawal({
		withdrawalParams,
		intent,
		referral,
		logger,
	}: {
		withdrawalParams: WithdrawalParams;
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
			onBeforePublishIntent?: OnBeforePublishIntentHook;
		};
		referral?: string;
		logger?: ILogger;
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new SingleWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				env: this.env,
				logger,
				intentSigner: intentSigner,
				intentRelayer: this.intentRelayer,
				intentPayloadFactory: intent?.payload,
				onBeforePublishIntent: intent?.onBeforePublishIntent,
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			referral: referral ?? this.referral,
			bridgeSDK: this,
			logger,
		});
	}

	createBatchWithdrawals({
		withdrawalParams,
		intent,
		referral,
		logger,
	}: {
		withdrawalParams: WithdrawalParams[];
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
			onBeforePublishIntent?: OnBeforePublishIntentHook;
		};
		referral?: string;
		logger?: ILogger;
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new BatchWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				env: this.env,
				logger,
				intentSigner,
				intentRelayer: this.intentRelayer,
				intentPayloadFactory: intent?.payload,
				onBeforePublishIntent: intent?.onBeforePublishIntent,
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			referral: referral ?? this.referral,
			bridgeSDK: this,
			logger,
		});
	}

	async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
		logger?: ILogger;
	}): Promise<IntentPrimitive[]> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const actualAmount = args.withdrawalParams.feeInclusive
					? args.withdrawalParams.amount - args.feeEstimation.amount
					: args.withdrawalParams.amount;

				await bridge.validateWithdrawal({
					assetId: args.withdrawalParams.assetId,
					amount: actualAmount,
					destinationAddress: args.withdrawalParams.destinationAddress,
					logger: args.logger,
				});

				return bridge.createWithdrawalIntents({
					withdrawalParams: {
						...args.withdrawalParams,
						amount: actualAmount,
					},
					feeEstimation: args.feeEstimation,
					referral: args.referral ?? this.referral,
				});
			}
		}

		throw new Error(
			`Cannot determine bridge for withdrawal = ${stringify(args.withdrawalParams)}`,
		);
	}

	async estimateWithdrawalFee<
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
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const fee = await bridge.estimateWithdrawalFee({
					withdrawalParams: args.withdrawalParams,
					quoteOptions: args.quoteOptions,
					logger: args.logger,
				});

				if (args.withdrawalParams.feeInclusive) {
					if (args.withdrawalParams.amount < fee.amount) {
						throw new FeeExceedsAmountError(fee, args.withdrawalParams.amount);
					}
				}

				return fee;
			}
		}

		throw new Error(
			`Cannot determine bridge for withdrawal = ${stringify(args.withdrawalParams)}`,
		);
	}

	waitForWithdrawalCompletion(args: {
		routeConfig: RouteConfig;
		tx: NearTxInfo;
		index: number;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<TxInfo | TxNoInfo> {
		for (const bridge of this.bridges) {
			if (bridge.is(args.routeConfig)) {
				return bridge.waitForWithdrawalCompletion({
					tx: args.tx,
					index: args.index,
					routeConfig: args.routeConfig,
					signal: args.signal,
					retryOptions: args.retryOptions,
					logger: args.logger,
				});
			}
		}

		throw new Error(`Unsupported bridge = ${stringify(args.routeConfig)}`);
	}

	parseAssetId(assetId: string): ParsedAssetInfo {
		for (const bridge of this.bridges) {
			const parsed = bridge.parseAssetId(assetId);
			if (parsed != null) {
				return parsed;
			}
		}

		throw new Error(`Cannot determine bridge for assetId = ${assetId}`);
	}
}

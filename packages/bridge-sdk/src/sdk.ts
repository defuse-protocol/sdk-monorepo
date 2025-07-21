import {
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
import { IntentsBridge } from "./bridges/intents-bridge/intents-bridge";
import { PoaBridge } from "./bridges/poa-bridge/poa-bridge";
import { BatchWithdrawalImpl } from "./classes/batch-withdrawal";
import { FeeExceedsAmountError } from "./classes/errors";
import { SingleWithdrawalImpl } from "./classes/single-withdrawal";
import { PUBLIC_EVM_RPC_URLS } from "./constants/evm-rpc-urls";
import { IntentExecuter } from "./intents/intent-executer-impl/intent-executer";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl";
import type { IIntentRelayer } from "./intents/interfaces/intent-relayer";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type {
	IntentHash,
	IntentPayloadFactory,
	IntentPrimitive,
	IntentRelayParamsFactory,
} from "./intents/shared-types";
import type {
	Bridge,
	BridgeConfig,
	FeeEstimation,
	IBridgeSDK,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "./shared-types";

export class BridgeSDK implements IBridgeSDK {
	protected env: NearIntentsEnv;
	protected referral: string;
	protected intentRelayer: IIntentRelayer<IntentHash>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];

	constructor(args: {
		env?: NearIntentsEnv;
		intentSigner?: IIntentSigner;
		// Fallback to public RPCs if omitted
		evmRpc?: Record<number, string[]>;
		// Fallback to public RPCs if omitted
		nearRpc?: string[];
		referral: string;
	}) {
		this.env = args.env ?? "production";
		this.referral = args.referral;

		const nearRpcUrls = args.nearRpc ?? PUBLIC_NEAR_RPC_URLS;
		const nearProvider = nearFailoverRpcProvider({ urls: nearRpcUrls });
		const evmRpcUrls = Object.assign(PUBLIC_EVM_RPC_URLS, args.evmRpc ?? {});

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
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			referral: referral ?? this.referral,
			bridgeSDK: this,
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
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			referral: referral ?? this.referral,
			bridgeSDK: this,
		});
	}

	async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const actualAmount = args.withdrawalParams.feeInclusive
					? args.withdrawalParams.amount - args.feeEstimation.amount
					: args.withdrawalParams.amount;

				await bridge.validateMinWithdrawalAmount({
					assetId: args.withdrawalParams.assetId,
					amount: actualAmount,
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
	/**
	 * Validates minimum withdrawal amount for the appropriate bridge.
	 * This should be called when the actual withdrawal amount is known.
	 * @throws {MinWithdrawalAmountError} If the amount is below the minimum required
	 */
	async validateMinWithdrawalAmount(args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void> {
		for (const bridge of this.bridges) {
			if (bridge.supports({ assetId: args.assetId })) {
				await bridge.validateMinWithdrawalAmount(args);
				return;
			}
		}

		throw new Error(`Cannot determine bridge for asset = ${args.assetId}`);
	}

	async estimateWithdrawalFee<
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
		bridge: BridgeConfig;
		tx: NearTxInfo;
		index: number;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<TxInfo | TxNoInfo> {
		for (const bridge of this.bridges) {
			if (bridge.is(args.bridge)) {
				return bridge.waitForWithdrawalCompletion({
					tx: args.tx,
					index: args.index,
					bridge: args.bridge,
					signal: args.signal,
					retryOptions: args.retryOptions,
					logger: args.logger,
				});
			}
		}

		throw new Error(`Unsupported bridge = ${args.bridge}`);
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

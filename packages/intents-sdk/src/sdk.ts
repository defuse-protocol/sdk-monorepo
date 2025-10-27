import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	PUBLIC_NEAR_RPC_URLS,
	RETRY_CONFIGS,
	type RetryOptions,
	configsByEnvironment,
	nearFailoverRpcProvider,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import { HotBridge as hotLabsOmniSdk_HotBridge } from "@hot-labs/omni-sdk";
import { stringify } from "viem";
import { AuroraEngineBridge } from "./bridges/aurora-engine-bridge/aurora-engine-bridge";
import { DirectBridge } from "./bridges/direct-bridge/direct-bridge";
import { HotBridge } from "./bridges/hot-bridge/hot-bridge";
import { HotBridgeEVMChains } from "./bridges/hot-bridge/hot-bridge-chains";
import { IntentsBridge } from "./bridges/intents-bridge/intents-bridge";
import { OmniBridge } from "./bridges/omni-bridge/omni-bridge";
import { PoaBridge } from "./bridges/poa-bridge/poa-bridge";
import { FeeExceedsAmountError } from "./classes/errors";
import {
	PUBLIC_EVM_RPC_URLS,
	PUBLIC_STELLAR_RPC_URLS,
} from "./constants/public-rpc-urls";
import { IntentExecuter } from "./intents/intent-executer-impl/intent-executer";
import { IntentRelayerPublic } from "./intents/intent-relayer-impl/intent-relayer-public";
import { noopIntentSigner } from "./intents/intent-signer-impl/intent-signer-noop";
import type { IIntentRelayer } from "./intents/interfaces/intent-relayer";
import type { IIntentSigner } from "./intents/interfaces/intent-signer";
import type {
	IntentHash,
	IntentPrimitive,
	IntentRelayParamsFactory,
} from "./intents/shared-types";
import { zip } from "./lib/array";
import { Chains } from "./lib/caip2";
import {
	configureEvmRpcUrls,
	configureStellarRpcUrls,
} from "./lib/configure-rpc-config";
import { determineRouteConfig } from "./lib/route-config";
import type {
	BatchWithdrawalResult,
	Bridge,
	FeeEstimation,
	IIntentsSDK,
	IntentPublishResult,
	IntentSettlementStatus,
	NearTxInfo,
	ParsedAssetInfo,
	PartialRPCEndpointMap,
	ProcessWithdrawalArgs,
	QuoteOptions,
	SignAndSendArgs,
	SignAndSendWithdrawalArgs,
	TxInfo,
	TxNoInfo,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalResult,
} from "./shared-types";

export interface IntentsSDKConfig {
	env?: NearIntentsEnv;
	intentSigner?: IIntentSigner;
	rpc?: PartialRPCEndpointMap;
	referral: string;
	solverRelayApiKey?: string;
}

export class IntentsSDK implements IIntentsSDK {
	protected env: NearIntentsEnv;
	protected referral: string;
	protected intentRelayer: IIntentRelayer<IntentHash>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];
	protected solverRelayApiKey: string | undefined;

	constructor(args: IntentsSDKConfig) {
		this.env = args.env ?? "production";
		this.referral = args.referral;
		this.solverRelayApiKey = args.solverRelayApiKey;

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
				solverRelayApiKey: this.solverRelayApiKey,
			}),
			new PoaBridge({
				env: this.env,
			}),
			new HotBridge({
				env: this.env,
				solverRelayApiKey: this.solverRelayApiKey,
				hotSdk: new hotLabsOmniSdk_HotBridge({
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
			new OmniBridge({
				env: this.env,
				nearProvider,
				solverRelayApiKey: this.solverRelayApiKey,
			}),
			new DirectBridge({
				env: this.env,
				nearProvider,
				solverRelayApiKey: this.solverRelayApiKey,
			}),
		];

		this.intentRelayer = new IntentRelayerPublic({
			env: this.env,
			solverRelayApiKey: this.solverRelayApiKey,
		});

		this.intentSigner = args.intentSigner;
	}

	public setIntentSigner(signer: IIntentSigner) {
		this.intentSigner = signer;
	}

	public async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
		logger?: ILogger;
	}): Promise<IntentPrimitive[]> {
		for (const bridge of this.bridges) {
			if (await bridge.supports(args.withdrawalParams)) {
				const actualAmount = args.withdrawalParams.feeInclusive
					? args.withdrawalParams.amount - args.feeEstimation.amount
					: args.withdrawalParams.amount;

				await bridge.validateWithdrawal({
					assetId: args.withdrawalParams.assetId,
					amount: actualAmount,
					destinationAddress: args.withdrawalParams.destinationAddress,
					feeEstimation: args.feeEstimation,
					routeConfig: args.withdrawalParams.routeConfig,
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

	public estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation>;

	public estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams[];
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation[]>;

	public estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams | WithdrawalParams[];
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation | FeeEstimation[]> {
		if (!Array.isArray(args.withdrawalParams)) {
			return this._estimateWithdrawalFee({
				...args,
				withdrawalParams: args.withdrawalParams,
			});
		}

		return Promise.all(
			args.withdrawalParams.map((withdrawalParams) =>
				this._estimateWithdrawalFee({
					...args,
					withdrawalParams,
				}),
			),
		);
	}

	protected async _estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		for (const bridge of this.bridges) {
			if (await bridge.supports(args.withdrawalParams)) {
				const fee = await bridge.estimateWithdrawalFee({
					withdrawalParams: args.withdrawalParams,
					quoteOptions: args.quoteOptions,
					logger: args.logger,
				});

				if (args.withdrawalParams.feeInclusive) {
					if (args.withdrawalParams.amount <= fee.amount) {
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

	protected getWithdrawalsIdentifiers({
		withdrawalParams,
		intentTx,
	}: {
		withdrawalParams: WithdrawalParams[];
		intentTx: NearTxInfo;
	}): WithdrawalIdentifier[] {
		const indexes = new Map<string, number>(
			zip(
				withdrawalParams.map((w) => {
					const routeConfig = determineRouteConfig(this, w);
					return routeConfig.route;
				}),
				Array(withdrawalParams.length).fill(0),
			),
		);

		return withdrawalParams.map((w): WithdrawalIdentifier => {
			const routeConfig = determineRouteConfig(this, w);
			const route = routeConfig.route;

			const index = indexes.get(route);
			assert(index != null, "Index is not found for route");
			indexes.set(route, index + 1);

			return {
				routeConfig: routeConfig,
				index,
				tx: intentTx,
			};
		});
	}

	public waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams;
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<TxInfo | TxNoInfo>;

	public waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams[];
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<Array<TxInfo | TxNoInfo>>;

	public async waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams | WithdrawalParams[];
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<(TxInfo | TxNoInfo) | Array<TxInfo | TxNoInfo>> {
		const wids = this.getWithdrawalsIdentifiers({
			withdrawalParams: Array.isArray(args.withdrawalParams)
				? args.withdrawalParams
				: [args.withdrawalParams],
			intentTx: args.intentTx,
		});

		const result = await Promise.all(
			wids.map((wid) => {
				for (const bridge of this.bridges) {
					if (bridge.is(wid.routeConfig)) {
						return bridge.waitForWithdrawalCompletion({
							tx: args.intentTx,
							index: wid.index,
							routeConfig: wid.routeConfig,
							signal: args.signal,
							retryOptions: args.retryOptions,
							logger: args.logger,
						});
					}
				}

				throw new Error(`Unsupported route = ${stringify(wid.routeConfig)}`);
			}),
		);

		if (Array.isArray(args.withdrawalParams)) {
			return result;
		}

		assert(result.length === 1, "Unexpected result length");
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return result[0]!;
	}

	public parseAssetId(assetId: string): ParsedAssetInfo {
		for (const bridge of this.bridges) {
			const parsed = bridge.parseAssetId(assetId);
			if (parsed != null) {
				return parsed;
			}
		}

		throw new Error(`Cannot determine bridge for assetId = ${assetId}`);
	}

	public async signAndSendIntent(
		args: SignAndSendArgs,
	): Promise<IntentPublishResult> {
		const intentSigner = args.signer ?? this.intentSigner;
		assert(intentSigner != null, "Intent signer is not provided");

		const intentExecuter = new IntentExecuter({
			env: this.env,
			logger: args.logger,
			intentSigner,
			intentRelayer: this.intentRelayer,
			intentPayloadFactory: args.payload,
			onBeforePublishIntent: args.onBeforePublishIntent,
		});

		const { ticket } = await intentExecuter.signAndSendIntent({
			intents: args.intents,
			relayParams: args.relayParams,
			signedIntents: args.signedIntents,
		});
		return { intentHash: ticket };
	}

	public async signAndSendWithdrawalIntent(
		args:
			| SignAndSendWithdrawalArgs<WithdrawalParams>
			| SignAndSendWithdrawalArgs<WithdrawalParams[]>,
	): Promise<IntentPublishResult> {
		let withdrawalParamsArray: WithdrawalParams[];
		let feeEstimations: FeeEstimation[];
		if (isBatchMode(args)) {
			withdrawalParamsArray = args.withdrawalParams;
			feeEstimations = args.feeEstimation;
		} else {
			withdrawalParamsArray = [args.withdrawalParams];
			feeEstimations = [args.feeEstimation];
		}

		const intentsP = zip(withdrawalParamsArray, feeEstimations).map(
			([withdrawalParams, feeEstimation]) => {
				return this.createWithdrawalIntents({
					withdrawalParams,
					feeEstimation,
					referral: args.referral ?? this.referral,
					logger: args.logger,
				});
			},
		);

		const intents = (await Promise.all(intentsP)).flat();

		const relayParamsFn: IntentRelayParamsFactory = async () => {
			const relayParams =
				args.intent?.relayParams != null
					? await args.intent?.relayParams()
					: { quoteHashes: undefined };

			const quoteHashes = relayParams.quoteHashes ?? [];

			for (const fee of feeEstimations) {
				if (fee.quote != null) {
					quoteHashes.push(fee.quote.quote_hash);
				}
			}

			return { ...relayParams, quoteHashes };
		};

		return this.signAndSendIntent({
			intents,
			signer: args.intent?.signer,
			onBeforePublishIntent: args.intent?.onBeforePublishIntent,
			relayParams: relayParamsFn,
			payload: args.intent?.payload,
			logger: args.logger,
			signedIntents: args.intent?.signedIntents,
		});
	}

	public async waitForIntentSettlement(args: {
		intentHash: IntentHash;
		logger?: ILogger;
	}): Promise<NearTxInfo> {
		const intentExecuter = new IntentExecuter({
			env: this.env,
			logger: args.logger,
			intentSigner: noopIntentSigner,
			intentRelayer: this.intentRelayer,
		});

		const { tx } = await intentExecuter.waitForSettlement(args.intentHash);
		return tx;
	}

	public async getIntentStatus({
		intentHash,
		logger,
	}: {
		intentHash: IntentHash;
		logger?: ILogger;
	}): Promise<IntentSettlementStatus> {
		return solverRelay.getStatus(
			{
				intent_hash: intentHash,
			},
			{
				baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
				logger,
				solverRelayApiKey: this.solverRelayApiKey,
			},
		);
	}

	// Orchestrated functions

	public processWithdrawal(
		args: ProcessWithdrawalArgs<WithdrawalParams>,
	): Promise<WithdrawalResult>;

	public processWithdrawal(
		args: ProcessWithdrawalArgs<WithdrawalParams[]>,
	): Promise<BatchWithdrawalResult>;

	async processWithdrawal(
		args: ProcessWithdrawalArgs<WithdrawalParams | WithdrawalParams[]>,
	): Promise<WithdrawalResult | BatchWithdrawalResult> {
		const withdrawalParams = Array.isArray(args.withdrawalParams)
			? args.withdrawalParams
			: [args.withdrawalParams];

		// Step 1: Estimate fee
		const feeEstimation = await (() => {
			if (args.feeEstimation != null) {
				return Array.isArray(args.feeEstimation)
					? args.feeEstimation
					: [args.feeEstimation];
			}

			return this.estimateWithdrawalFee({
				withdrawalParams,
				logger: args.logger,
			});
		})();

		// Step 2: Sign and send intent
		const { intentHash } = await this.signAndSendWithdrawalIntent({
			withdrawalParams,
			feeEstimation,
			referral: args.referral,
			intent: args.intent,
			logger: args.logger,
		});

		// Step 3: Wait for intent settlement
		const intentTx = await this.waitForIntentSettlement({
			intentHash: intentHash,
			logger: args.logger,
		});

		// Step 4: Wait for withdrawal completion
		const destinationTx = await this.waitForWithdrawalCompletion({
			withdrawalParams,
			intentTx,
			retryOptions: args.retryOptions ?? RETRY_CONFIGS.FIVE_MINS_STEADY,
			logger: args.logger,
		});

		if (!Array.isArray(args.withdrawalParams)) {
			return {
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				feeEstimation: feeEstimation[0]!,
				intentHash,
				intentTx,
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				destinationTx: destinationTx[0]!,
			};
		}

		return {
			feeEstimation,
			intentHash,
			intentTx,
			destinationTx,
		};
	}
}

function isBatchMode(
	args:
		| SignAndSendWithdrawalArgs<WithdrawalParams>
		| SignAndSendWithdrawalArgs<WithdrawalParams[]>,
): args is SignAndSendWithdrawalArgs<WithdrawalParams[]> {
	return Array.isArray(args.withdrawalParams);
}

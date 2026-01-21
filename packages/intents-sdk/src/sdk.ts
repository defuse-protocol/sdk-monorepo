import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	PUBLIC_NEAR_RPC_URLS,
	configsByEnvironment,
	nearFailoverRpcProvider,
	solverRelay,
	RelayPublishError,
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
	MultiPayload,
} from "./intents/shared-types";
import { zip } from "./lib/array";
import { type Chain, Chains } from "./lib/caip2";
import { RouteEnum } from "./constants/route-enum";
import {
	configureEvmRpcUrls,
	configureStellarRpcUrls,
} from "./lib/configure-rpc-config";
import {
	createWithdrawalIdentifiers,
	watchWithdrawal,
} from "./core/withdrawal-watcher";
import type {
	BatchWithdrawalResult,
	Bridge,
	CreateWithdrawalCompletionPromisesParams,
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
	WithdrawalParams,
	WithdrawalResult,
} from "./shared-types";
import type { ISaltManager } from "./intents/interfaces/salt-manager";
import { SaltManager } from "./intents/salt-manager";
import type { Salt } from "./intents/expirable-nonce";
import {
	VersionedNonceBuilder,
	saltedNonceSchema,
} from "./intents/expirable-nonce";
import { IntentPayloadBuilder } from "./intents/intent-payload-builder";
import { DEFAULT_DEADLINE_MS } from "./intents/intent-payload-factory";
import * as v from "valibot";

export interface IntentsSDKConfig {
	env?: NearIntentsEnv;
	intentSigner?: IIntentSigner;
	rpc?: PartialRPCEndpointMap;
	referral: string;
	solverRelayApiKey?: string;
	features?: {
		/**
		 * Route migrated POA tokens (*.omft.near) through Omni Bridge.
		 * Enable this to use Omni Bridge for POA tokens that have been migrated to the Omni infrastructure.
		 */
		routeMigratedPoaTokensThroughOmniBridge?: boolean;
	};
}

export class IntentsSDK implements IIntentsSDK {
	protected env: NearIntentsEnv;
	protected referral: string;
	protected intentRelayer: IIntentRelayer<IntentHash>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];
	protected solverRelayApiKey: string | undefined;
	protected saltManager: ISaltManager;

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
				routeMigratedPoaTokensThroughOmniBridge:
					args.features?.routeMigratedPoaTokensThroughOmniBridge,
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
				routeMigratedPoaTokensThroughOmniBridge:
					args.features?.routeMigratedPoaTokensThroughOmniBridge,
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

		this.saltManager = new SaltManager({
			env: this.env,
			nearProvider,
		});
	}

	public setIntentSigner(signer: IIntentSigner) {
		this.intentSigner = signer;
	}

	/**
	 * Create a new intent payload builder with environment context.
	 * Use this to build custom intent payloads for your API or advanced use cases.
	 *
	 * @returns A new IntentPayloadBuilder instance configured with the SDK's environment
	 *
	 * @example
	 * ```typescript
	 * // Build a custom intent payload
	 * const payload = await sdk.intentBuilder()
	 *   .setSigner('0x1234...') // User's EVM address
	 *   .setDeadline(new Date(Date.now() + 5 * 60 * 1000))
	 *   .addIntent({
	 *     intent: 'ft_withdraw',
	 *     token: 'usdc.omft.near',
	 *     amount: '1000000',
	 *     receiver_id: 'user.near'
	 *   })
	 *   .build();
	 *
	 * // Return to user for signing with their preferred method (MetaMask, etc.)
	 * return payload;
	 * ```
	 */
	public intentBuilder(): IntentPayloadBuilder {
		return new IntentPayloadBuilder({
			env: this.env,
			saltManager: this.saltManager,
		});
	}

	/**
	 * Invalidate multiple nonces by creating and sending empty signed intents.
	 * This prevents previously created but unused intent payloads from being executed.
	 *
	 * For expirable nonces (versioned nonces with embedded deadlines), the intent's
	 * deadline is automatically set to the minimum of:
	 * 1. The nonce's embedded deadline (can't exceed this)
	 * 2. 1 minute from now (for quick invalidation when possible)
	 *
	 * @param args.nonces - Array of nonce strings to invalidate (up to 400 nonces per call, but depends on gas consumption)
	 * @param args.signer - Optional intent signer to use (defaults to SDK's configured signer)
	 * @param args.logger - Optional logger for debugging
	 *
	 * @example
	 * ```typescript
	 * // Invalidate unused nonces
	 * await sdk.invalidateNonces({
	 *   nonces: ['nonce1', 'nonce2', 'nonce3']
	 * });
	 * ```
	 */
	public async invalidateNonces(args: {
		nonces: string[];
		signer?: IIntentSigner;
		logger?: ILogger;
	}): Promise<void> {
		if (args.nonces.length === 0) {
			return;
		}

		const intentSigner = args.signer ?? this.intentSigner;
		assert(intentSigner != null, "Intent signer is not provided");

		// Create empty signed intents for each nonce
		const signedIntents = await Promise.all(
			args.nonces.map(async (nonce) => {
				const builder = this.intentBuilder().setNonce(nonce);

				// For expirable nonces, extract the deadline and use the minimum of:
				// 1. Nonce's deadline (can't exceed this)
				// 2. 1 minute from now (prefer shorter deadline for quick invalidation)
				try {
					const decoded = VersionedNonceBuilder.decodeNonce(nonce);

					// Validate the decoded structure using valibot
					if (v.is(saltedNonceSchema, decoded.value)) {
						// Convert nanoseconds to milliseconds and create Date
						const nonceDeadlineMs = Number(
							decoded.value.inner.deadline / 1_000_000n,
						);
						const nonceDeadline = new Date(nonceDeadlineMs);

						// Use 1 minute from now, but cap at nonce's deadline
						const oneMinuteFromNow = new Date(Date.now() + DEFAULT_DEADLINE_MS);
						const deadline =
							oneMinuteFromNow < nonceDeadline
								? oneMinuteFromNow
								: nonceDeadline;

						builder.setDeadline(deadline);
					} else {
						args.logger?.warn?.(
							"Decoded nonce has unexpected structure, using default deadline",
						);
					}
				} catch {
					// If decoding fails (e.g., old nonce format), continue without setting deadline
					// The builder will use default 1 minute deadline
				}

				const { signed } = await builder.buildAndSign(intentSigner);
				return signed;
			}),
		);

		// Publish all invalidation intents atomically
		// As for 15 Nov 2025, it's impossible to track onchain invalidation,
		// because Relayer doesn't publish such intents onchain. It invalidates in-memory only.
		await this.intentRelayer.publishIntents(
			{ multiPayloads: signedIntents, quoteHashes: [] },
			{ logger: args.logger },
		);
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
			`Cannot determine bridge for withdrawal = ${stringify(
				args.withdrawalParams,
			)}`,
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
			`Cannot determine bridge for withdrawal = ${stringify(
				args.withdrawalParams,
			)}`,
		);
	}

	/**
	 * Wait for withdrawal(s) to complete on the destination chain.
	 *
	 * **Important:** Waits until the withdrawal completes, fails, or the chain-specific
	 * p99 timeout is exceeded. Use `AbortSignal.timeout()` to set a shorter timeout budget.
	 *
	 * @throws {WithdrawalWatchError} When status polling fails (timeout or consecutive errors).
	 *   Inspect `error.cause` to determine the reason.
	 * @throws {WithdrawalFailedError} When the withdrawal fails on the destination chain.
	 * @throws {DOMException} When the provided AbortSignal is aborted (name: "AbortError").
	 *
	 * @param args.withdrawalParams - Single withdrawal or array of withdrawals
	 * @param args.intentTx - The NEAR transaction info from the published intent
	 * @param args.signal - Optional AbortSignal for cancellation/timeout
	 * @param args.logger - Optional logger for debugging
	 *
	 * @example
	 * ```typescript
	 * // With timeout
	 * const result = await sdk.waitForWithdrawalCompletion({
	 *   withdrawalParams,
	 *   intentTx,
	 *   signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minute timeout
	 * });
	 * ```
	 */
	public waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams;
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		logger?: ILogger;
	}): Promise<TxInfo | TxNoInfo>;

	public waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams[];
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		logger?: ILogger;
	}): Promise<Array<TxInfo | TxNoInfo>>;

	public async waitForWithdrawalCompletion(args: {
		withdrawalParams: WithdrawalParams | WithdrawalParams[];
		intentTx: NearTxInfo;
		signal?: AbortSignal;
		logger?: ILogger;
	}): Promise<(TxInfo | TxNoInfo) | Array<TxInfo | TxNoInfo>> {
		const withdrawalParamsArray = Array.isArray(args.withdrawalParams)
			? args.withdrawalParams
			: [args.withdrawalParams];

		const promises = this.createWithdrawalCompletionPromises({
			withdrawalParams: withdrawalParamsArray,
			intentTx: args.intentTx,
			signal: args.signal,
			logger: args.logger,
		});

		const result = await Promise.all(promises);

		if (Array.isArray(args.withdrawalParams)) {
			return result;
		}

		assert(result.length === 1, "Unexpected result length");
		// biome-ignore lint/style/noNonNullAssertion: length asserted above
		return result[0]!;
	}

	/**
	 * Create promises that resolve when each withdrawal completes on the destination chain.
	 * Use this for granular control over handling individual withdrawals as they complete,
	 * rather than waiting for all to finish.
	 *
	 * **Important:** Each promise waits until the withdrawal completes, fails, or the
	 * chain-specific p99 timeout is exceeded. Use `AbortSignal.timeout()` to set a
	 * shorter timeout budget.
	 *
	 * @throws {WithdrawalWatchError} When status polling fails (timeout or consecutive errors).
	 *   Inspect `error.cause` to determine the reason.
	 * @throws {WithdrawalFailedError} When the withdrawal fails on the destination chain.
	 * @throws {DOMException} When the provided AbortSignal is aborted (name: "AbortError").
	 *
	 * @param params.withdrawalParams - Array of withdrawal parameters
	 * @param params.intentTx - The NEAR transaction info from the published intent
	 * @param params.signal - Optional AbortSignal for cancellation/timeout
	 * @param params.logger - Optional logger for debugging
	 * @returns Array of promises, one per withdrawal, that resolve with transaction info
	 *
	 * @example
	 * ```typescript
	 * const promises = sdk.createWithdrawalCompletionPromises({
	 *   withdrawalParams: [withdrawal1, withdrawal2],
	 *   intentTx,
	 *   signal: AbortSignal.timeout(5 * 60 * 1000), // 5 minute timeout
	 * });
	 *
	 * // Handle each withdrawal as it completes
	 * for (const promise of promises) {
	 *   promise.then((result) => console.log('Withdrawal completed:', result));
	 * }
	 * ```
	 */
	public createWithdrawalCompletionPromises(
		params: CreateWithdrawalCompletionPromisesParams,
	): Array<Promise<TxInfo | TxNoInfo>> {
		const { withdrawalParams, intentTx, signal, logger } = params;

		const widsPromise = createWithdrawalIdentifiers({
			bridges: this.bridges,
			withdrawalParams,
			intentTx,
		});

		// Track the last promise per HOT bridge landing chain for sequential waiting.
		// HOT bridge processes withdrawals sequentially per chain with ~30s gaps,
		// so polling in parallel would cause later withdrawals to timeout.
		const hotChainLastPromise = new Map<Chain, Promise<TxInfo | TxNoInfo>>();

		return withdrawalParams.map(async (_, index) => {
			const wids = await widsPromise;
			const entry = wids[index];
			assert(entry != null, `Missing wid for index ${index}`);

			// Only apply sequential waiting for HOT bridge
			if (entry.bridge.route === RouteEnum.HotBridge) {
				const landingChain = entry.wid.landingChain;
				const previousPromise = hotChainLastPromise.get(landingChain);

				const sequentialPromise = (async () => {
					if (previousPromise) {
						// Wait for previous withdrawal to same chain to complete.
						// Use allSettled to continue even if previous fails.
						await Promise.allSettled([previousPromise]);
					}
					return watchWithdrawal({
						bridge: entry.bridge,
						wid: entry.wid,
						signal,
						logger,
					});
				})();

				hotChainLastPromise.set(landingChain, sequentialPromise);
				return sequentialPromise;
			}

			// Non-HOT bridges: parallel polling (existing behavior)
			return watchWithdrawal({
				bridge: entry.bridge,
				wid: entry.wid,
				signal,
				logger,
			});
		});
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

	public async sendSignedIntents(args: {
		multiPayloads: MultiPayload[];
		quoteHashes?: string[];
		logger?: ILogger;
	}): Promise<{ tickets: IntentHash[] }> {
		const tickets = await this.intentRelayer.publishIntents(
			{
				multiPayloads: args.multiPayloads,
				quoteHashes: args.quoteHashes ?? [],
			},
			{ logger: args.logger },
		);

		return { tickets };
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

		const { ticket } = await this.withSaltRetry(args, async (salt) =>
			intentExecuter.signAndSendIntent({
				intents: args.intents,
				salt,
				relayParams: args.relayParams,
				signedIntents: args.signedIntents,
			}),
		);

		return { intentHash: ticket };
	}

	private async withSaltRetry<T>(
		args: SignAndSendArgs,
		fn: (salt: Salt) => Promise<T>,
	): Promise<T> {
		try {
			const cachedSalt = await this.saltManager.getCachedSalt();

			return await fn(cachedSalt);
		} catch (err) {
			if (!(err instanceof RelayPublishError && err.code === "INVALID_SALT"))
				throw err;

			args.logger?.warn?.("Salt error detected. Refreshing salt and retrying");

			const newSalt = await this.saltManager.refresh();
			return fn(newSalt);
		}
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
		/** AbortSignal for cancellation/timeout. Use AbortSignal.timeout(ms) for timeout. */
		signal?: AbortSignal;
		logger?: ILogger;
	}): Promise<NearTxInfo> {
		const intentExecuter = new IntentExecuter({
			env: this.env,
			logger: args.logger,
			intentSigner: noopIntentSigner,
			intentRelayer: this.intentRelayer,
		});

		const { tx } = await intentExecuter.waitForSettlement(args.intentHash, {
			signal: args.signal,
		});
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
			logger: args.logger,
		});

		if (!Array.isArray(args.withdrawalParams)) {
			return {
				// biome-ignore lint/style/noNonNullAssertion: single withdrawal returns single-element arrays
				feeEstimation: feeEstimation[0]!,
				intentHash,
				intentTx,
				// biome-ignore lint/style/noNonNullAssertion: single withdrawal returns single-element arrays
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

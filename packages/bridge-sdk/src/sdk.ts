import type {
	NearIntentsEnv,
	RetryOptions,
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
		evmRpc: Record<number, string[]>;
		referral: string;
	}) {
		this.env = args.env ?? "production";
		this.referral = args.referral;

		/**
		 * Order of bridges matters, because the first bridge that supports the `withdrawalParams` will be used.
		 * More specific bridges should be placed before more generic ones.
		 */
		this.bridges = [
			new IntentsBridge(),
			new AuroraEngineBridge({ env: this.env }),
			new PoaBridge({ env: this.env }),
			new HotBridge({
				env: this.env,
				hotSdk: new hotOmniSdk.HotBridge({
					logger: console,
					evmRpc: args.evmRpc,
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			}),
			new DirectBridge({ env: this.env }),
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
	}: {
		withdrawalParams: WithdrawalParams;
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
		};
		referral?: string;
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new SingleWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				env: this.env,
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
	}: {
		withdrawalParams: WithdrawalParams[];
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
		};
		referral?: string;
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new BatchWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				env: this.env,
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

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				return bridge.createWithdrawalIntents({
					withdrawalParams: {
						...args.withdrawalParams,
						amount: args.withdrawalParams.feeInclusive
							? args.withdrawalParams.amount - args.feeEstimation.amount
							: args.withdrawalParams.amount,
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
			| "bridgeConfig"
			| "feeInclusive"
			| "amount"
		>,
	>(args: {
		withdrawalParams: T;
		quoteOptions?: { waitMs: number };
	}): Promise<FeeEstimation> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const fee = await bridge.estimateWithdrawalFee({
					withdrawalParams: args.withdrawalParams,
					quoteOptions: args.quoteOptions,
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
	}): Promise<TxInfo | TxNoInfo> {
		for (const bridge of this.bridges) {
			if (bridge.is(args.bridge)) {
				return bridge.waitForWithdrawalCompletion({
					tx: args.tx,
					index: args.index,
					bridge: args.bridge,
					signal: args.signal,
					retryOptions: args.retryOptions,
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

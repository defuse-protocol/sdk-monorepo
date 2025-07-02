import hotOmniSdk from "@hot-labs/omni-sdk";
import { AuroraEngineBridge } from "./bridges/aurora-engine-bridge/aurora-engine-bridge";
import { DirectBridge } from "./bridges/direct-bridge/direct-bridge";
import { HotBridge } from "./bridges/hot-bridge/hot-bridge";
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
	protected intentRelayer: IIntentRelayer<IntentHash>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];

	constructor(args: {
		intentSigner?: IIntentSigner;
		evmRpc: Record<number, string[]>;
	}) {
		this.bridges = [
			new AuroraEngineBridge(),
			new PoaBridge(),
			new HotBridge(
				new hotOmniSdk.HotBridge({
					logger: console,
					evmRpc: args.evmRpc,
					async executeNearTransaction() {
						throw new Error("not implemented");
					},
				}),
			),
			new DirectBridge(),
		];

		this.intentRelayer = new IntentRelayerPublic();

		this.intentSigner = args.intentSigner;
	}

	setIntentSigner(signer: IIntentSigner) {
		this.intentSigner = signer;
	}

	createWithdrawal({
		withdrawalParams,
		intent,
	}: {
		withdrawalParams: WithdrawalParams;
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
		};
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new SingleWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				intentSigner: intentSigner,
				intentRelayer: this.intentRelayer,
				intentPayloadFactory: intent?.payload,
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			bridgeSDK: this,
		});
	}

	createBatchWithdrawals({
		withdrawalParams,
		intent,
	}: {
		withdrawalParams: WithdrawalParams[];
		intent?: {
			payload?: IntentPayloadFactory;
			relayParams?: IntentRelayParamsFactory;
			signer?: IIntentSigner;
		};
	}) {
		const intentSigner = intent?.signer ?? this.intentSigner;
		if (intentSigner == null) {
			throw new Error("Intent signer is not provided");
		}

		return new BatchWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				intentSigner,
				intentRelayer: this.intentRelayer,
				intentPayloadFactory: intent?.payload,
			}),
			// @ts-expect-error
			intentRelayParams: intent?.relayParams,
			withdrawalParams,
			bridgeSDK: this,
		});
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
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
				});
			}
		}

		throw new Error(
			`Cannot determine bridge for assetId = ${args.withdrawalParams.assetId}`,
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
	}): Promise<FeeEstimation> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const fee = await bridge.estimateWithdrawalFee({
					withdrawalParams: args.withdrawalParams,
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
			`Cannot determine bridge for assetId = ${args.withdrawalParams.assetId}`,
		);
	}

	waitForWithdrawalCompletion(args: {
		bridge: BridgeConfig;
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo | TxNoInfo> {
		for (const bridge of this.bridges) {
			if (bridge.is(args.bridge)) {
				return bridge.waitForWithdrawalCompletion({
					tx: args.tx,
					index: args.index,
					bridge: args.bridge,
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

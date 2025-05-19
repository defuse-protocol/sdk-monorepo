import { BatchWithdrawalImpl } from "./classes/batch-withdrawal.ts";
import { FeeExceedsAmountError } from "./classes/errors.ts";
import { SingleWithdrawalImpl } from "./classes/single-withdrawal.ts";
import { IntentExecuter } from "./intents/intent-executer-impl/intent-executer.ts";
import type { IIntentRelayer } from "./intents/interfaces/intent-relayer.ts";
import type { IIntentSigner } from "./intents/interfaces/intent-signer.ts";
import type {
	IntentPayloadFactory,
	IntentPrimitive,
	IntentRelayParamsFactory,
} from "./intents/shared-types.ts";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	IBridgeSDK,
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "./shared-types.ts";

export class BridgeSDK<Ticket> implements IBridgeSDK {
	protected intentRelayer: IIntentRelayer<Ticket>;
	protected intentSigner?: IIntentSigner;
	protected bridges: Bridge[];

	constructor(args: {
		bridges: Bridge[];
		intentRelayer: IIntentRelayer<Ticket>;
		intentSigner?: IIntentSigner;
	}) {
		this.bridges = args.bridges;
		this.intentRelayer = args.intentRelayer;
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
		};
	}) {
		if (this.intentSigner == null) {
			throw new Error("Intent signer is not set");
		}

		return new SingleWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				intentSigner: this.intentSigner,
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
		};
	}) {
		if (this.intentSigner == null) {
			throw new Error("Intent signer is not set");
		}

		return new BatchWithdrawalImpl({
			intentExecuter: new IntentExecuter({
				intentSigner: this.intentSigner,
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

		throw new Error(`Unsupported bridge = ${args.withdrawalParams.bridge}`);
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args.withdrawalParams)) {
				const fee = await bridge.estimateWithdrawalFee({
					withdrawalParams: args.withdrawalParams,
				});

				if (args.withdrawalParams.feeInclusive) {
					if (args.withdrawalParams.amount < fee.amount) {
						throw new FeeExceedsAmountError(
							fee.amount,
							args.withdrawalParams.amount,
						);
					}
				}

				return fee;
			}
		}

		throw new Error(`Unsupported bridge = ${args.withdrawalParams.bridge}`);
	}

	waitForWithdrawalCompletion(args: {
		bridge: BridgeKind;
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo | TxNoInfo> {
		for (const bridge of this.bridges) {
			if (bridge.supports(args)) {
				return bridge.waitForWithdrawalCompletion({
					tx: args.tx,
					index: args.index,
				});
			}
		}

		throw new Error(`Unsupported bridge = ${args.bridge}`);
	}
}

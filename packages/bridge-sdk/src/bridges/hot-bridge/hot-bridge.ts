import { getQuote } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/getQuote";
import type { HotBridge as HotSdk } from "@hot-labs/omni-sdk";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import { wait } from "../../lib/async.ts";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types.ts";
import { HOT_WITHDRAW_STATUS_STRINGS } from "./hot-bridge-constants.ts";
import { getFeeAssetIdForChain, toHOTNetwork } from "./hot-bridge-utils.ts";

export class HotBridge implements Bridge {
	constructor(protected hotSdk: HotSdk) {}

	supports(params: { bridge: BridgeKind }): boolean {
		return params.bridge === "hot";
	}

	async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]> {
		const intents: IntentPrimitive[] = [];
		let feeAmount: bigint;

		if (args.feeEstimation.quote == null) {
			feeAmount = args.feeEstimation.amount;
		} else {
			feeAmount = BigInt(args.feeEstimation.quote.amount_out);
			intents.push({
				intent: "token_diff",
				diff: {
					[args.feeEstimation.quote.defuse_asset_identifier_in]:
						`-${args.feeEstimation.quote.amount_in}`,
					[args.feeEstimation.quote.defuse_asset_identifier_out]:
						args.feeEstimation.quote.amount_out,
				},
			});
		}

		const intent = await this.hotSdk.buildGaslessWithdrawIntent({
			feeToken: "native",
			feeAmount,
			chain: toHOTNetwork(args.withdrawalParams.destinationChain),
			token: args.withdrawalParams.sourceAddress,
			amount: args.withdrawalParams.amount,
			receiver: args.withdrawalParams.destinationAddress,
			intentAccount: "", // it is not used inside the function
		});

		intents.push(intent as Extract<IntentPrimitive, { intent: "mt_withdraw" }>);

		return intents;
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation> {
		const { gasPrice: feeAmount } = await this.hotSdk.getGaslessWithdrawFee(
			toHOTNetwork(args.withdrawalParams.destinationChain),
			args.withdrawalParams.sourceAddress,
		);

		const feeAssetId = getFeeAssetIdForChain(
			args.withdrawalParams.destinationChain,
		);

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId
				? null
				: await getQuote({
						quoteParams: {
							defuse_asset_identifier_in: args.withdrawalParams.assetId,
							defuse_asset_identifier_out: feeAssetId,
							exact_amount_out: feeAmount.toString(),
						},
						config: { logBalanceSufficient: false },
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
			quote: feeQuote,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo | TxNoInfo> {
		const nonces = await this.hotSdk.near.parseWithdrawalNonces(
			args.tx.hash,
			args.tx.accountId,
		);
		const nonce = nonces[args.index];
		if (nonce == null) {
			throw new Error("Withdrawal with given index is not found");
		}

		let attempts = 0;
		while (true) {
			if (attempts > 30) {
				throw new Error(
					`Gasless withdrawal was not completed, nonce = ${nonce}`,
				);
			}

			await wait(2000);

			const status = await this.hotSdk.getGaslessWithdrawStatus(
				nonce.toString(),
			);

			if (status === HOT_WITHDRAW_STATUS_STRINGS.Canceled) {
				throw new Error("Gasless withdrawal was canceled");
			}
			if (status === HOT_WITHDRAW_STATUS_STRINGS.Completed) {
				return { hash: null };
			}
			if (typeof status === "string") {
				// todo: 0x is only for EVM, so need to check destination chain
				return { hash: `0x${status}` };
			}

			attempts += 1;
		}
	}
}

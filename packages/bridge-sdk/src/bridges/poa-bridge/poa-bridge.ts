import { getWithdrawalEstimate } from "@defuse-protocol/defuse-sdk/dist/sdk/poaBridge/poaBridgeHttpClient/apis";
import { waitForWithdrawalCompletion } from "@defuse-protocol/defuse-sdk/dist/sdk/poaBridge/waitForWithdrawalCompletion";
import { getTokenAccountId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types.ts";
import {
	createWithdrawIntentPrimitive,
	toPoaNetwork,
} from "./poa-bridge-utils.ts";

export class PoaBridge implements Bridge {
	supports(params: { bridge: BridgeKind }): boolean {
		return params.bridge === "poa";
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]> {
		const intent = createWithdrawIntentPrimitive({
			...args.withdrawalParams,
			amount: args.withdrawalParams.amount + args.feeEstimation.amount,
		});
		return Promise.resolve([intent]);
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: WithdrawalParams;
	}): Promise<FeeEstimation> {
		const estimation = await getWithdrawalEstimate({
			token: getTokenAccountId(args.withdrawalParams.assetId),
			address: args.withdrawalParams.destinationAddress,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			chain: toPoaNetwork(args.withdrawalParams.destinationChain) as any,
		});

		return {
			amount: BigInt(estimation.withdrawalFee),
			quote: null,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
	}): Promise<TxInfo> {
		const withdrawalStatus = await waitForWithdrawalCompletion({
			txHash: args.tx.hash,
			index: args.index,
			signal: new AbortController().signal,
		});

		return { hash: withdrawalStatus.destinationTxHash };
	}
}

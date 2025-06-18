import { getWithdrawalEstimate } from "@defuse-protocol/defuse-sdk/dist/sdk/poaBridge/poaBridgeHttpClient/apis";
import { waitForWithdrawalCompletion } from "@defuse-protocol/defuse-sdk/dist/sdk/poaBridge/waitForWithdrawalCompletion";
import {
	getTokenAccountId,
	parseDefuseAssetId,
} from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	contractIdToCaip2,
	createWithdrawIntentPrimitive,
	toPoaNetwork,
} from "./poa-bridge-utils";

export class PoaBridge implements Bridge {
	supports(params: { assetId: string } | { bridge: BridgeKind }): boolean {
		if ("bridge" in params) {
			return params.bridge === "poa";
		}

		try {
			return this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);
		if (parsed.contractId.endsWith(".omft.near")) {
			return Object.assign(parsed, {
				blockchain: contractIdToCaip2(parsed.contractId),
				bridge: "poa" as const,
				address: "", // todo: derive address (or native)
			});
		}
		return null;
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
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const estimation = await getWithdrawalEstimate({
			token: getTokenAccountId(args.withdrawalParams.assetId),
			address: args.withdrawalParams.destinationAddress,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			chain: toPoaNetwork(assetInfo.blockchain) as any,
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

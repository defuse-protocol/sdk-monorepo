import { getQuote } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/getQuote";
import { parseDefuseAssetId } from "@defuse-protocol/defuse-sdk/dist/utils/tokenUtils";
import type { HotBridge as HotSdk } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
import type { IntentPrimitive } from "../../intents/shared-types.ts";
import { assert } from "../../lib/assert.ts";
import { wait } from "../../lib/async.ts";
import type {
	Bridge,
	BridgeKind,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types.ts";
import { HOT_WITHDRAW_STATUS_STRINGS } from "./hot-bridge-constants.ts";
import {
	getFeeAssetIdForChain,
	networkIdToCaip2,
	toHOTNetwork,
} from "./hot-bridge-utils.ts";

export class HotBridge implements Bridge {
	constructor(protected hotSdk: HotSdk) {}

	supports(params: { assetId: string } | { bridge: BridgeKind }): boolean {
		if ("bridge" in params) {
			return params.bridge === "hot";
		}

		try {
			return this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);
		if (parsed.contractId === utils.OMNI_HOT_V2) {
			assert(
				parsed.standard === "nep245",
				"NEP-245 is supported only for HOT bridge",
			);
			const [chainId] = parsed.tokenId.split("_");
			assert(chainId != null, "Chain ID is not found");

			return Object.assign(parsed, {
				blockchain: networkIdToCaip2(chainId),
				bridge: "hot" as const,
			});
		}
		return null;
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

		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const intent = await this.hotSdk.buildGaslessWithdrawIntent({
			feeToken: "native",
			feeAmount,
			chain: toHOTNetwork(assetInfo.blockchain),
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
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const { gasPrice: feeAmount } = await this.hotSdk.getGaslessWithdrawFee(
			toHOTNetwork(assetInfo.blockchain),
			args.withdrawalParams.sourceAddress,
		);

		const feeAssetId = getFeeAssetIdForChain(assetInfo.blockchain);

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

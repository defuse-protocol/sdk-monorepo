import {
	type NearIntentsEnv,
	configsByEnvironment,
	utils as internalUtils,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { HotBridge as HotSdk } from "@hot-labs/omni-sdk";
import { utils } from "@hot-labs/omni-sdk";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { wait } from "../../lib/async";
import type {
	Bridge,
	BridgeConfig,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import { HOT_WITHDRAW_STATUS_STRINGS } from "./hot-bridge-constants";
import {
	formatTxHash,
	getFeeAssetIdForChain,
	hotBlockchainInvariant,
	networkIdToCaip2,
	toHOTNetwork,
} from "./hot-bridge-utils";

export class HotBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected hotSdk: HotSdk;

	constructor({ env, hotSdk }: { env: NearIntentsEnv; hotSdk: HotSdk }) {
		this.env = env;
		this.hotSdk = hotSdk;
	}

	is(bridgeConfig: BridgeConfig): boolean {
		return bridgeConfig.bridge === "hot";
	}

	supports(
		params: Pick<WithdrawalParams, "assetId" | "bridgeConfig">,
	): boolean {
		let result = true;

		if ("bridgeConfig" in params && params.bridgeConfig != null) {
			result &&= this.is(params.bridgeConfig);
		}

		try {
			return result && this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = internalUtils.parseDefuseAssetId(assetId);
		if (parsed.contractId === utils.OMNI_HOT_V2) {
			assert(
				parsed.standard === "nep245",
				"NEP-245 is supported only for HOT bridge",
			);
			const [chainId, address] = utils.fromOmni(parsed.tokenId).split(":");
			assert(chainId != null, "Chain ID is not found");
			assert(address != null, "Address is not found");

			return Object.assign(
				parsed,
				{
					blockchain: networkIdToCaip2(chainId),
					bridge: "hot" as const,
				},
				(address === "native" ? { native: true } : { address }) as
					| { native: true }
					| { address: string },
			);
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

		const isNative = "native" in assetInfo;
		const amount = args.withdrawalParams.amount + (isNative ? feeAmount : 0n);

		const intent = await this.hotSdk.buildGaslessWithdrawIntent({
			feeToken: "native",
			feeAmount,
			chain: toHOTNetwork(assetInfo.blockchain),
			token: isNative ? "native" : assetInfo.address,
			amount,
			receiver: args.withdrawalParams.destinationAddress,
			intentAccount: "", // it is not used inside the function
		});

		// Sanity check, in case HOT SDK changes
		assert(intent.amounts[0] === amount.toString(), "Amount is not correct");
		if (intent.amounts.length === 2) {
			assert(
				intent.amounts[1] === feeAmount.toString(),
				"Amount is not correct",
			);
		}

		intents.push(intent as Extract<IntentPrimitive, { intent: "mt_withdraw" }>);

		return intents;
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<WithdrawalParams, "assetId">;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");
		hotBlockchainInvariant(assetInfo.blockchain);

		const { gasPrice: feeAmount } = await this.hotSdk.getGaslessWithdrawFee(
			toHOTNetwork(assetInfo.blockchain),
			"native" in assetInfo ? "native" : assetInfo.address,
		);

		const feeAssetId = getFeeAssetIdForChain(assetInfo.blockchain);

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId
				? null
				: await solverRelay.getQuote({
						quoteParams: {
							defuse_asset_identifier_in: args.withdrawalParams.assetId,
							defuse_asset_identifier_out: feeAssetId,
							exact_amount_out: feeAmount.toString(),
						},
						config: {
							baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
							logBalanceSufficient: false,
						},
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
			quote: feeQuote,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		bridge: BridgeConfig;
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
				return {
					hash:
						"chain" in args.bridge
							? formatTxHash(status, args.bridge.chain)
							: status,
				};
			}

			attempts += 1;
		}
	}
}

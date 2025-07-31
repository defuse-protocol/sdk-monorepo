import {
	configsByEnvironment,
	type ILogger,
	type NearIntentsEnv,
	omniBridge,
	RETRY_CONFIGS,
	type RetryOptions,
	utils,
} from "@defuse-protocol/internal-utils";
import type { providers } from "near-api-js";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import { CAIP2_NETWORK } from "../../lib/caip2";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	RouteConfig,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	createWithdrawIntentPrimitive,
	getTransferNonce,
} from "./omni-bridge-utils";
import {
	OMNI_ARB_PREFIX,
	OMNI_BASE_PREFIX,
	OMNI_BRIDGE_FACTORY,
	OMNI_BTC_ADDRESS_ON_NEAR,
	OMNI_ETH_ADDRESS_ON_NEAR,
	OMNI_ETH_FACTORY,
	OMNI_SOL_PREFIX,
	supportedNetworks,
} from "./omni-bridge-constants";
import { retry } from "@lifeomic/attempt";

export class OmniBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;

	constructor({
		env,
		nearProvider,
	}: { env: NearIntentsEnv; nearProvider: providers.Provider }) {
		this.env = env;
		this.nearProvider = nearProvider;
	}

	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.OmniBridge;
	}

	// Check if token supported
	supports(params: Pick<WithdrawalParams, "assetId" | "routeConfig">): boolean {
		let result = true;

		if ("routeConfig" in params && params.routeConfig != null) {
			result &&= this.is(params.routeConfig);
		}

		try {
			return result && this.parseAssetId(params.assetId) != null;
		} catch {
			return false;
		}
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = utils.parseDefuseAssetId(assetId);

		if (parsed.standard !== "nep141") return null;
		let originChain = null;

		if (parsed.contractId === OMNI_BTC_ADDRESS_ON_NEAR)
			originChain = CAIP2_NETWORK.Bitcoin;
		else if (parsed.contractId === OMNI_ETH_ADDRESS_ON_NEAR)
			originChain = CAIP2_NETWORK.Ethereum;
		else if (parsed.contractId.endsWith(OMNI_BRIDGE_FACTORY)) {
			if (parsed.contractId.includes(OMNI_BASE_PREFIX)) {
				originChain = CAIP2_NETWORK.Base;
			} else if (parsed.contractId.includes(OMNI_ARB_PREFIX)) {
				originChain = CAIP2_NETWORK.Arbitrum;
			} else if (parsed.contractId.includes(OMNI_SOL_PREFIX)) {
				originChain = CAIP2_NETWORK.Solana;
			}
		} else if (parsed.contractId.endsWith(OMNI_ETH_FACTORY)) {
			originChain = CAIP2_NETWORK.Ethereum;
		}
		if (originChain === null) return null;
		return Object.assign(parsed, {
			blockchain: originChain,
			bridgeName: BridgeNameEnum.Omni,
			address: parsed.contractId,
		});
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");
		// need to be moved
		assert(
			args.withdrawalParams.amount > args.feeEstimation.amount,
			"Withdrawal amount is less than fee amount",
		);

		const intents: IntentPrimitive[] = [];

		const intent = createWithdrawIntentPrimitive({
			assetId: args.withdrawalParams.assetId,
			destinationAddress: args.withdrawalParams.destinationAddress,
			amount: args.withdrawalParams.amount,
			origin: assetInfo.blockchain,
			storageDeposit: 0n,
			transferredTokenFee: args.feeEstimation.amount,
		});

		intents.push(intent);

		return Promise.resolve(intents);
	}

	/**
	 * Omni bridge doesn't have minimum withdrawal amount restrictions.
	 */
	async validateMinWithdrawalAmount(_args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void> {
		return;
	}

	// doesnt include verifcation for storage deposit
	// probably need to throw in case storage deposit is not present
	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<
			WithdrawalParams,
			"assetId" | "destinationAddress" | "routeConfig"
		>;
		quoteOptions?: { waitMs: number };
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");
		const fee = await omniBridge.httpClient.fee({
			token: `near:${assetInfo.contractId}`,
			sender: `near:${configsByEnvironment[this.env].contractID}`,
			//@ts-ignore
			recipient: `${supportedNetworks[assetInfo.blockchain]}:${args.withdrawalParams.destinationAddress}`,
		});
		// Need to be moved somewhere
		// validateMinWithdrawalAmount is a candidate but it doesnt have a fee amount passed
		assert(
			fee.transferred_token_fee != null,
			"Asset is not supported by the relayer",
		);

		return {
			amount: BigInt(fee.transferred_token_fee),
			quote: null,
		};
		// const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
		// 	args.withdrawalParams.assetId,
		// );
		// assert(standard === "nep141", "Only NEP-141 is supported");

		// const [minStorageBalance, userStorageBalance] = await Promise.all([
		// 	getNearNep141MinStorageBalance({
		// 		contractId: tokenAccountId,
		// 		nearProvider: this.nearProvider,
		// 	}),
		// 	getNearNep141StorageBalance({
		// 		contractId: tokenAccountId,
		// 		accountId: args.withdrawalParams.destinationAddress,
		// 		nearProvider: this.nearProvider,
		// 	}),
		// ]);

		// if (minStorageBalance <= userStorageBalance) {
		// 	return {
		// 		amount: 0n,
		// 		quote: null,
		// 	};
		// }

		// const feeAssetId = NEAR_NATIVE_ASSET_ID;
		// const feeAmount = minStorageBalance - userStorageBalance;

		// const feeQuote =
		// 	args.withdrawalParams.assetId === feeAssetId
		// 		? null
		// 		: await solverRelay.getQuote({
		// 			quoteParams: {
		// 				defuse_asset_identifier_in: args.withdrawalParams.assetId,
		// 				defuse_asset_identifier_out: feeAssetId,
		// 				exact_amount_out: feeAmount.toString(),
		// 				wait_ms: args.quoteOptions?.waitMs,
		// 			},
		// 			config: {
		// 				baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
		// 				logBalanceSufficient: false,
		// 				logger: args.logger,
		// 			},
		// 		});

		// return {
		// 	amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
		// 	quote: feeQuote,
		// };
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		routeConfig: RouteConfig;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	}): Promise<TxInfo | TxNoInfo> {
		return retry(
			async () => {
				if (args.signal?.aborted) {
					throw args.signal.reason;
				}

				const transferNonce = await getTransferNonce(
					this.nearProvider,
					configsByEnvironment[this.env].contractID,
					args.tx.hash,
				);
				if (transferNonce === null) throw new Error("Nonce not found");
				const transfer = await omniBridge.httpClient.transfer({
					originChain: "Near",
					originNonce: transferNonce,
				});
				//@ts-ignore
				const destinationChain =
					transfer.transfer_message.recipient.split(":")[0];
				let txHash = null;
				if (
					destinationChain === "eth" ||
					destinationChain === "arb" ||
					destinationChain === "base"
				) {
					//@ts-ignore
					txHash = transfer.finalised.EVMLog.transaction_hash;
				} else if (destinationChain === "sol") {
					//@ts-ignore
					txHash = transfer.finalised.Solana.signature;
				} else {
					throw new Error("Not supported destination chain");
				}
				if (!txHash) throw new Error("Hash not found");
				return { hash: txHash };
			},
			{
				...(args.retryOptions ?? RETRY_CONFIGS.TWO_MINS_GRADUAL),
				handleError: (err, ctx) => {
					if (
						err.text === "Nonce not found" ||
						err.text === "Not supported destination chain" ||
						err === args.signal?.reason
					) {
						ctx.abort();
					}
				},
			},
		);
	}
}

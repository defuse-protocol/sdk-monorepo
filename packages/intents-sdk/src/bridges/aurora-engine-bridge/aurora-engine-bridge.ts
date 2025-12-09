import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	utils,
} from "@defuse-protocol/internal-utils";
import type { providers } from "near-api-js";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import type {
	Bridge,
	FeeEstimation,
	QuoteOptions,
	RouteConfig,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import { getUnderlyingFee } from "../../lib/estimate-fee";
import { NEAR_NATIVE_ASSET_ID } from "./aurora-engine-bridge-constants";
import {
	createWithdrawIntentPrimitive,
	withdrawalParamsInvariant,
} from "./aurora-engine-bridge-utils";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { getFeeQuote } from "../../lib/estimate-fee";
import { validateAddress } from "../../lib/validateAddress";

export class AuroraEngineBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;
	protected solverRelayApiKey: string | undefined;

	constructor({
		env,
		nearProvider,
		solverRelayApiKey,
	}: {
		env: NearIntentsEnv;
		nearProvider: providers.Provider;
		solverRelayApiKey?: string;
	}) {
		this.env = env;
		this.nearProvider = nearProvider;
		this.solverRelayApiKey = solverRelayApiKey;
	}

	is(routeConfig: RouteConfig): boolean {
		return routeConfig.route === RouteEnum.VirtualChain;
	}

	async supports(
		params: Pick<WithdrawalParams, "assetId" | "routeConfig">,
	): Promise<boolean> {
		if (params.routeConfig == null || !this.is(params.routeConfig)) {
			return false;
		}

		const assetInfo = parseDefuseAssetId(params.assetId);
		const isValid = assetInfo.standard === "nep141";

		if (!isValid) {
			throw new UnsupportedAssetIdError(
				params.assetId,
				"`assetId` does not match `routeConfig`.",
			);
		}
		return isValid;
	}

	parseAssetId(): null {
		return null;
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		withdrawalParamsInvariant(args.withdrawalParams);

		const intents: IntentPrimitive[] = [];

		if (args.feeEstimation.quote != null) {
			intents.push({
				intent: "token_diff",
				diff: {
					[args.feeEstimation.quote.defuse_asset_identifier_in]:
						`-${args.feeEstimation.quote.amount_in}`,
					[args.feeEstimation.quote.defuse_asset_identifier_out]:
						args.feeEstimation.quote.amount_out,
				},
				referral: args.referral,
			});
		}

		const intent = createWithdrawIntentPrimitive({
			assetId: args.withdrawalParams.assetId,
			auroraEngineContractId:
				args.withdrawalParams.routeConfig.auroraEngineContractId,
			proxyTokenContractId:
				args.withdrawalParams.routeConfig.proxyTokenContractId,
			destinationAddress: args.withdrawalParams.destinationAddress,
			amount: args.withdrawalParams.amount,
			storageDeposit: getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.VirtualChain,
				"storageDepositFee",
			),
		});

		intents.push(intent);

		return Promise.resolve(intents);
	}

	/**
	 * Aurora Engine bridge doesn't have withdrawal restrictions.
	 */
	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		logger?: ILogger;
	}): Promise<void> {
		if (validateAddress(args.destinationAddress, Chains.Ethereum) === false) {
			throw new InvalidDestinationAddressForWithdrawalError(
				args.destinationAddress,
				"virtual-chain",
			);
		}

		return;
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<WithdrawalParams, "assetId" | "routeConfig">;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		withdrawalParamsInvariant(args.withdrawalParams);

		const { contractId: tokenAccountId, standard } = utils.parseDefuseAssetId(
			args.withdrawalParams.assetId,
		);
		assert(standard === "nep141", "Only NEP-141 is supported");

		const [minStorageBalance, userStorageBalance] = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: tokenAccountId,
				nearProvider: this.nearProvider,
			}),
			getNearNep141StorageBalance({
				contractId: tokenAccountId,
				accountId: args.withdrawalParams.routeConfig.auroraEngineContractId,
				nearProvider: this.nearProvider,
			}),
		]);

		if (minStorageBalance <= userStorageBalance) {
			return {
				amount: 0n,
				quote: null,
				underlyingFees: {
					[RouteEnum.VirtualChain]: {
						storageDepositFee: 0n,
					},
				},
			};
		}

		const feeAssetId = NEAR_NATIVE_ASSET_ID;
		const feeAmount = minStorageBalance - userStorageBalance;

		const feeQuote =
			args.withdrawalParams.assetId === feeAssetId
				? null
				: await getFeeQuote({
						feeAmount,
						feeAssetId,
						tokenAssetId: args.withdrawalParams.assetId,
						logger: args.logger,
						env: this.env,
						quoteOptions: args.quoteOptions,
						solverRelayApiKey: this.solverRelayApiKey,
					});

		return {
			amount: feeQuote ? BigInt(feeQuote.amount_in) : feeAmount,
			quote: feeQuote,
			underlyingFees: {
				[RouteEnum.VirtualChain]: {
					storageDepositFee: feeAmount,
				},
			},
		};
	}

	async waitForWithdrawalCompletion(): Promise<TxNoInfo> {
		return { hash: null };
	}
}

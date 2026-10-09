import {
	assert,
	type ILogger,
	type EnvConfig,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	utils,
} from "@defuse-protocol/internal-utils";
import type { providers } from "near-api-js";
import {
	InvalidDestinationAddressForWithdrawalError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { Chains } from "../../lib/caip2";
import { getFeeQuote, getUnderlyingFee } from "../../lib/estimate-fee";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import { validateAddress } from "../../lib/validateAddress";
import type {
	Bridge,
	BridgeConfigs,
	FeeEstimation,
	NearTxInfo,
	QuoteOptions,
	RouteConfig,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalStatus,
} from "../../shared-types";
import { NEAR_NATIVE_ASSET_ID } from "./aurora-engine-bridge-constants";
import {
	createWithdrawIntentPrimitive,
	withdrawalParamsInvariant,
} from "./aurora-engine-bridge-utils";

export class AuroraEngineBridge implements Bridge {
	readonly route = RouteEnum.VirtualChain;
	protected envConfig: EnvConfig;
	protected nearProvider: providers.Provider;
	protected solverRelayApiKey: string | undefined;
	protected bridgeConfig: NonNullable<BridgeConfigs[RouteEnum["VirtualChain"]]>;

	constructor({
		envConfig,
		nearProvider,
		solverRelayApiKey,
		bridgeConfig = {},
	}: {
		envConfig: EnvConfig;
		nearProvider: providers.Provider;
		solverRelayApiKey?: string;
		bridgeConfig?: BridgeConfigs[RouteEnum["VirtualChain"]];
	}) {
		this.envConfig = envConfig;
		this.nearProvider = nearProvider;
		this.solverRelayApiKey = solverRelayApiKey;
		this.bridgeConfig = bridgeConfig;
	}

	/**
	 * Whether withdrawal fees of `assetId` are prefunded, so fee quoting can be skipped.
	 * `feesPrefunded: true` applies to all tokens and overrides `prefundedFeesTokens`.
	 */
	private feesPrefunded(assetId: string): boolean {
		return (
			this.bridgeConfig.feesPrefunded === true ||
			(this.bridgeConfig.prefundedFeesTokens?.includes(assetId) ?? false)
		);
	}

	private is(routeConfig: RouteConfig): boolean {
		return routeConfig.route === this.route;
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

		// No quote needed when the withdrawn asset is already the fee asset.
		if (args.withdrawalParams.assetId === feeAssetId) {
			return {
				amount: feeAmount,
				quote: null,
				underlyingFees: {
					[RouteEnum.VirtualChain]: {
						storageDepositFee: feeAmount,
					},
				},
			};
		}

		// Quote is not needed for prefunded fees, we assume account already holds fee asset.
		if (this.feesPrefunded(args.withdrawalParams.assetId)) {
			return {
				amount: 0n,
				quote: null,
				underlyingFees: {
					[RouteEnum.VirtualChain]: {
						storageDepositFee: feeAmount,
					},
				},
			};
		}
		const feeQuote = await getFeeQuote({
			feeAmount,
			feeAssetId,
			tokenAssetId: args.withdrawalParams.assetId,
			logger: args.logger,
			envConfig: this.envConfig,
			quoteOptions: args.quoteOptions,
			solverRelayApiKey: this.solverRelayApiKey,
		});

		return {
			amount: BigInt(feeQuote.amount_in),
			quote: feeQuote,
			underlyingFees: {
				[RouteEnum.VirtualChain]: {
					storageDepositFee: feeAmount,
				},
			},
		};
	}

	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier {
		return {
			landingChain: Chains.Near,
			index: args.index,
			withdrawalParams: args.withdrawalParams,
			tx: args.tx,
		};
	}

	async describeWithdrawal(): Promise<WithdrawalStatus> {
		return { status: "completed", txHash: null };
	}
}

import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	RETRY_CONFIGS,
	type RetryOptions,
	configsByEnvironment,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
} from "@defuse-protocol/internal-utils";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import TTLCache from "@isaacs/ttlcache";
import { retry } from "@lifeomic/attempt";
import type { providers } from "near-api-js";
import {
	ChainKind,
	type OmniAddress,
	OmniBridgeAPI,
	type TokenDecimals,
	getChain,
	getMinimumTransferableAmount,
	isEvmChain,
	omniAddress,
	parseOriginChain,
	verifyTransferAmount,
} from "omni-bridge-sdk";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type { Chain } from "../../lib/caip2";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	OmniBridgeRouteConfig,
	ParsedAssetInfo,
	QuoteOptions,
	RouteConfig,
	TxInfo,
	TxNoInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	OmniTokenNormalisationCheckError,
	OmniTransferDestinationChainHashNotFoundError,
	OmniTransferNotFoundError,
	TokenNotFoundInDestinationChainError,
	FailedToFetchFeeError,
	IntentsNearOmniAvailableBalanceTooLowError,
} from "./error";
import {
	MIN_ALLOWED_STORAGE_BALANCE_FOR_INTENTS_NEAR,
	NEAR_NATIVE_ASSET_ID,
	OMNI_BRIDGE_CONTRACT,
} from "./omni-bridge-constants";
import {
	caip2ToChainKind,
	chainKindToCaip2,
	createWithdrawIntentsPrimitive,
	getBridgedToken,
	getAccountOmniStorageBalance,
	validateOmniToken,
	getTokenDecimals,
	getBtcBridgeConfig,
} from "./omni-bridge-utils";
import { LRUCache } from "lru-cache";
import { getFeeQuote } from "../../lib/estimate-fee";
import {
	InvalidDestinationAddressForWithdrawalError,
	MinWithdrawalAmountError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { validateAddress } from "../../lib/validateAddress";

type MinStorageBalance = bigint;
type StorageDepositBalance = bigint;
export class OmniBridge implements Bridge {
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;
	protected omniBridgeAPI: OmniBridgeAPI;
	protected solverRelayApiKey: string | undefined;
	private storageDepositCache = new LRUCache<
		string,
		[MinStorageBalance, StorageDepositBalance]
	>({ max: 100, ttl: 3600000 });
	private destinationChainAddressCache = new TTLCache<
		string,
		OmniAddress | null
	>({ ttl: 3600000 });
	private tokenDecimalsCache = new TTLCache<OmniAddress, TokenDecimals>({
		ttl: 3600000,
	});

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
		this.omniBridgeAPI = new OmniBridgeAPI();
		this.solverRelayApiKey = solverRelayApiKey;
	}

	is(routeConfig: RouteConfig): boolean {
		return routeConfig.route === RouteEnum.OmniBridge;
	}

	async supports(
		params: Pick<WithdrawalParams, "assetId" | "routeConfig">,
	): Promise<boolean> {
		// Non omni bridge route specified, abort.
		if (params.routeConfig && !this.is(params.routeConfig)) {
			return false;
		}
		const parsed = parseDefuseAssetId(params.assetId);
		const omniBridgeSetWithNoChain = Boolean(
			params.routeConfig &&
				params.routeConfig.route === RouteEnum.OmniBridge &&
				params.routeConfig.chain === undefined,
		);
		const targetChainSpecified = this.targetChainSpecified(params.routeConfig);
		const nonValidStandard = parsed.standard !== "nep141";
		// only nep141 supported
		if (
			nonValidStandard &&
			(omniBridgeSetWithNoChain || targetChainSpecified)
		) {
			throw new UnsupportedAssetIdError(
				params.assetId,
				`Only NEP-141 tokens are supported by Omni Bridge.`,
			);
		}
		if (nonValidStandard) return false;
		// Should only allow tokens bridged from other networks unless a specific
		// chain for withdrawal is set.
		const nonValidToken = validateOmniToken(parsed.contractId) === false;
		if (nonValidToken && omniBridgeSetWithNoChain) {
			throw new UnsupportedAssetIdError(
				params.assetId,
				`Non valid omni contract id ${parsed.contractId}`,
			);
		}
		if (!targetChainSpecified && nonValidToken) return false;

		let omniChainKind: ChainKind | null = null;
		let caip2Chain: Chain | null = null;
		// Transfer to some specific chain specified in route config
		if (this.targetChainSpecified(params.routeConfig)) {
			omniChainKind = caip2ToChainKind(params.routeConfig.chain);
			if (omniChainKind === null) {
				throw new UnsupportedAssetIdError(
					params.assetId,
					`Chain ${params.routeConfig.chain} is not supported in Omni Bridge.`,
				);
			}
			caip2Chain = params.routeConfig.chain;
		} else {
			// Transfer of an omni token to it's origin chain
			omniChainKind = parseOriginChain(parsed.contractId);

			if (omniChainKind === null) {
				throw new UnsupportedAssetIdError(
					params.assetId,
					`Withdrawal of ${parsed.contractId} to its origin chain is not supported in Omni Bridge.`,
				);
			}
			caip2Chain = chainKindToCaip2(omniChainKind);

			if (caip2Chain === null) {
				throw new UnsupportedAssetIdError(
					params.assetId,
					`Withdrawal of ${parsed.contractId} to its origin chain is not supported in Omni Bridge.`,
				);
			}
		}
		const tokenOnDestinationNetwork =
			await this.getCachedDestinationTokenAddress(
				parsed.contractId,
				omniChainKind,
			);
		if (tokenOnDestinationNetwork === null) {
			throw new TokenNotFoundInDestinationChainError(
				params.assetId,
				caip2Chain,
			);
		}

		return true;
	}

	targetChainSpecified(
		routeConfig?: RouteConfig,
	): routeConfig is OmniBridgeRouteConfig & { chain: Chain } {
		return Boolean(
			routeConfig?.route &&
				routeConfig.route === RouteEnum.OmniBridge &&
				routeConfig.chain,
		);
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);
		if (parsed.standard !== "nep141") return null;
		const omniChainKind = parseOriginChain(parsed.contractId);
		if (omniChainKind === null) return null;
		const blockchain = chainKindToCaip2(omniChainKind);
		if (blockchain === null) return null;
		return Object.assign(parsed, {
			blockchain,
			bridgeName: BridgeNameEnum.Omni,
			address: parsed.contractId,
		});
	}

	makeAssetInfo(assetId: string, routeConfig?: RouteConfig) {
		const parsed = parseDefuseAssetId(assetId);
		if (parsed.standard !== "nep141") return null;
		let omniChainKind = null;
		let blockchain = null;
		if (this.targetChainSpecified(routeConfig)) {
			omniChainKind = caip2ToChainKind(routeConfig.chain);
			blockchain = routeConfig.chain;
		} else {
			omniChainKind = parseOriginChain(parsed.contractId);
			if (omniChainKind === null) return null;
			blockchain = chainKindToCaip2(omniChainKind);
		}
		if (omniChainKind === null || blockchain === null) return null;

		return Object.assign(parsed, {
			blockchain,
			bridgeName: BridgeNameEnum.Omni,
			address: parsed.contractId,
		});
	}

	async createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
		referral?: string;
	}): Promise<IntentPrimitive[]> {
		const assetInfo = this.makeAssetInfo(
			args.withdrawalParams.assetId,
			args.withdrawalParams.routeConfig,
		);
		assert(
			assetInfo !== null,
			`Asset ${args.withdrawalParams.assetId} is not supported by Omni Bridge`,
		);
		const omniChainKind = caip2ToChainKind(assetInfo.blockchain);
		assert(
			omniChainKind !== null,
			`Chain ${assetInfo.blockchain} is not supported by Omni Bridge`,
		);
		const [minStorageBalance, currentStorageBalance] =
			await this.getCachedStorageDepositValue(assetInfo.contractId);
		const storageDepositAmount =
			minStorageBalance > currentStorageBalance
				? minStorageBalance - currentStorageBalance
				: 0n;

		let maxGasFee = 0n;
		// Withdrawal to Bitcoin need max_gas_fee value indicated in the msg
		if (omniChainKind === ChainKind.Btc) {
			const fee = await this.omniBridgeAPI.getFee(
				omniAddress(ChainKind.Near, configsByEnvironment[this.env].contractID),
				omniAddress(omniChainKind, args.withdrawalParams.destinationAddress),
				omniAddress(ChainKind.Near, assetInfo.contractId),
				args.withdrawalParams.amount,
			);
			assert(
				fee.max_gas_fee !== null && fee.max_gas_fee !== undefined,
				"Failed to receive max gas fee value for a BTC transfer",
			);
			assert(
				fee.max_gas_fee > 0n,
				`Invalid max_gas_fee value ${fee.max_gas_fee}`,
			);
			maxGasFee = fee.max_gas_fee;
		}

		const intents: IntentPrimitive[] = [];

		if (args.feeEstimation.quote !== null) {
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

		// args.feeEstimation.quote === null  only for withdrawing nep141:wrap.near
		const nativeFee =
			(args.feeEstimation.quote === null
				? args.feeEstimation.amount
				: // args.feeEstimation.quote.amount_out is always nep141:wrap.near
					BigInt(args.feeEstimation.quote.amount_out)) - storageDepositAmount;

		assert(
			nativeFee >= 0n,
			`Native fee cannot be negative. Storage deposit amount (${storageDepositAmount}) exceeds fee estimation (${args.feeEstimation.quote === null ? args.feeEstimation.amount : BigInt(args.feeEstimation.quote.amount_out)}). This may indicate a race condition where storage balance changed between fee estimation and intent creation.`,
		);

		intents.push(
			...createWithdrawIntentsPrimitive({
				assetId: args.withdrawalParams.assetId,
				destinationAddress: args.withdrawalParams.destinationAddress,
				amount: args.withdrawalParams.amount,
				omniChainKind,
				intentsContract: configsByEnvironment[this.env].contractID,
				// we need to calculate relayer fee
				// if we send nep141:wrap.near total fee in NEAR is args.feeEstimation.amount
				// if we send any other token total fee in NEAR is args.feeEstimation.quote.amount_out
				nativeFee,
				storageDepositAmount,
				maxGasFee,
			}),
		);

		return Promise.resolve(intents);
	}

	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		feeEstimation: FeeEstimation;
		routeConfig?: RouteConfig;
		logger?: ILogger;
	}): Promise<void> {
		assert(
			args.feeEstimation.amount > 0n,
			`Fee must be greater than zero. Current fee is ${args.feeEstimation.amount}.`,
		);

		const assetInfo = this.makeAssetInfo(args.assetId, args.routeConfig);

		assert(
			assetInfo !== null,
			`Asset ${args.assetId} is not supported by Omni Bridge`,
		);

		if (
			validateAddress(args.destinationAddress, assetInfo.blockchain) === false
		) {
			throw new InvalidDestinationAddressForWithdrawalError(
				args.destinationAddress,
				assetInfo.blockchain,
			);
		}

		const omniChainKind = caip2ToChainKind(assetInfo.blockchain);
		assert(
			omniChainKind !== null,
			`Chain ${assetInfo.blockchain} is not supported by Omni Bridge`,
		);

		const destTokenAddress = await this.getCachedDestinationTokenAddress(
			assetInfo.contractId,
			omniChainKind,
		);
		if (destTokenAddress === null) {
			throw new TokenNotFoundInDestinationChainError(
				args.assetId,
				assetInfo.blockchain,
			);
		}

		const decimals = await this.getCachedTokenDecimals(destTokenAddress);
		assert(
			decimals !== null,
			`Failed to retrieve token decimals for address ${destTokenAddress} via OmniBridge contract. 
  Ensure the token is supported and the address is correct.`,
		);
		const normalisationCheckSucceeded = verifyTransferAmount(
			// args.amount is without fee, we need to pass an amount being sent to relayer so we add fee here
			args.amount + args.feeEstimation.amount,
			args.feeEstimation.amount,
			decimals.origin_decimals,
			decimals.decimals,
		);
		if (normalisationCheckSucceeded === false) {
			const minAmount = getMinimumTransferableAmount(
				decimals.origin_decimals,
				decimals.decimals,
			);
			throw new OmniTokenNormalisationCheckError(
				args.assetId,
				destTokenAddress,
				minAmount,
				args.feeEstimation.amount,
			);
		}

		const storageBalance = await getAccountOmniStorageBalance(
			this.nearProvider,
			configsByEnvironment[this.env].contractID,
		);

		const intentsNearStorageBalance =
			storageBalance === null ? 0n : BigInt(storageBalance.available);
		// Ensure available storage balance is > MIN_ALLOWED_STORAGE_BALANCE_FOR_INTENTS_NEAR.
		// If it’s lower, block the transfer—otherwise the funds will be refunded
		// to the intents contract account instead of the original withdrawing account.
		if (
			intentsNearStorageBalance <= MIN_ALLOWED_STORAGE_BALANCE_FOR_INTENTS_NEAR
		) {
			throw new IntentsNearOmniAvailableBalanceTooLowError(
				intentsNearStorageBalance.toString(),
			);
		}

		if (omniChainKind === ChainKind.Btc) {
			const config = await getBtcBridgeConfig(this.nearProvider);
			// args.amount is without fee
			// BTC connector that actually do the withdrawal has a custom
			// min withdraw amount which is not harcoded and can be updated in the contract.
			const minAmount = BigInt(config.min_withdraw_amount);
			if (args.amount < minAmount) {
				throw new MinWithdrawalAmountError(
					minAmount,
					args.amount,
					args.assetId,
				);
			}
		}

		return;
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<
			WithdrawalParams,
			"assetId" | "destinationAddress" | "routeConfig" | "amount"
		>;
		quoteOptions?: QuoteOptions;
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.makeAssetInfo(
			args.withdrawalParams.assetId,
			args.withdrawalParams.routeConfig,
		);
		assert(
			assetInfo !== null,
			`Asset ${args.withdrawalParams.assetId} is not supported by Omni Bridge`,
		);

		const omniChainKind = caip2ToChainKind(assetInfo.blockchain);
		assert(
			omniChainKind !== null,
			`Chain ${assetInfo.blockchain} is not supported by Omni Bridge`,
		);
		const fee = await this.omniBridgeAPI.getFee(
			omniAddress(ChainKind.Near, configsByEnvironment[this.env].contractID),
			omniAddress(omniChainKind, args.withdrawalParams.destinationAddress),
			omniAddress(ChainKind.Near, assetInfo.contractId),
			args.withdrawalParams.amount,
		);
		if (fee.native_token_fee === null) {
			throw new FailedToFetchFeeError(args.withdrawalParams.assetId);
		}

		let totalAmountToQuote = fee.native_token_fee;

		const [minStorageBalance, currentStorageBalance] =
			await this.getCachedStorageDepositValue(assetInfo.contractId);

		if (minStorageBalance > currentStorageBalance) {
			totalAmountToQuote += minStorageBalance - currentStorageBalance;
		}

		// withdraw of nep141:wrap.near
		if (args.withdrawalParams.assetId === NEAR_NATIVE_ASSET_ID) {
			return {
				amount: totalAmountToQuote,
				quote: null,
			};
		}

		const quote = await getFeeQuote({
			feeAmount: totalAmountToQuote,
			feeAssetId: NEAR_NATIVE_ASSET_ID,
			tokenAssetId: args.withdrawalParams.assetId,
			logger: args.logger,
			env: this.env,
			quoteOptions: args.quoteOptions,
			solverRelayApiKey: this.solverRelayApiKey,
		});

		let amount = BigInt(quote.amount_in);
		// For btc withdrawal we also need to take into consideration
		// max_gas_fee - max amount of BTC that can be spent on gas in Bitcoin network
		// protocol_fee - constant fee taken by the relayer
		if (omniChainKind === ChainKind.Btc) {
			assert(
				fee.max_gas_fee !== null && fee.max_gas_fee !== undefined,
				"Invalid max_gas_fee value returned from omni bridge api for BTC withdrawal",
			);
			assert(
				fee.max_gas_fee >= 0n,
				`Invalid max_gas_fee value ${fee.max_gas_fee}`,
			);
			assert(
				fee.protocol_fee !== null && fee.protocol_fee !== undefined,
				"Invalid protocol_fee value returned from omni bridge api for BTC withdrawal",
			);
			assert(
				fee.protocol_fee >= 0n,
				`Invalid protocol_fee value ${fee.protocol_fee}`,
			);
			amount += fee.max_gas_fee + fee.protocol_fee;
		}
		return {
			amount,
			quote,
		};
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

				const transfer = (
					await this.omniBridgeAPI.getTransfer({
						transactionHash: args.tx.hash,
					})
				)[args.index];
				if (transfer == null || transfer.transfer_message == null)
					throw new OmniTransferNotFoundError(args.tx.hash);
				const destinationChain = getChain(
					transfer.transfer_message.recipient as OmniAddress,
				);
				let txHash = null;
				if (isEvmChain(destinationChain)) {
					txHash = transfer.finalised?.EVMLog?.transaction_hash;
				} else if (destinationChain === ChainKind.Sol) {
					txHash = transfer.finalised?.Solana?.signature;
				} else if (destinationChain === ChainKind.Btc) {
					txHash = transfer.finalised?.UtxoLog?.transaction_hash;
				} else {
					return { hash: null };
				}
				if (!txHash)
					throw new OmniTransferDestinationChainHashNotFoundError(
						args.tx.hash,
						ChainKind[destinationChain].toLowerCase(),
					);
				return { hash: txHash };
			},
			{
				...(args.retryOptions ?? RETRY_CONFIGS.FIVE_MINS_STEADY),
				handleError: (err, ctx) => {
					if (err === args.signal?.reason) {
						ctx.abort();
					}
				},
			},
		);
	}

	/**
	 * Gets storage deposit for a token to avoid frequent RPC calls.
	 */
	private async getCachedStorageDepositValue(
		contractId: string,
	): Promise<[MinStorageBalance, StorageDepositBalance]> {
		const cached = this.storageDepositCache.get(contractId);
		if (cached !== undefined) {
			return cached;
		}

		const result = await Promise.all([
			getNearNep141MinStorageBalance({
				contractId: contractId,
				nearProvider: this.nearProvider,
			}),
			getNearNep141StorageBalance({
				contractId: contractId,
				accountId: OMNI_BRIDGE_CONTRACT,
				nearProvider: this.nearProvider,
			}),
		]);

		if (result[1] >= result[0]) {
			this.storageDepositCache.set(contractId, result);
		}

		return result;
	}

	/**
	 * Gets cached token address on destination chain.
	 */
	private async getCachedDestinationTokenAddress(
		contractId: string,
		omniChainKind: ChainKind,
	): Promise<OmniAddress | null> {
		const key = `${omniChainKind}:${contractId}`;
		const cached = this.destinationChainAddressCache.get(key);
		if (cached !== undefined) {
			return cached;
		}

		const tokenOnDestinationNetwork = await getBridgedToken(
			this.nearProvider,
			omniAddress(ChainKind.Near, contractId),
			omniChainKind,
		);

		if (tokenOnDestinationNetwork !== null) {
			this.destinationChainAddressCache.set(key, tokenOnDestinationNetwork);
		}

		return tokenOnDestinationNetwork;
	}

	/**
	 * Gets cached token decimals on destination chain and on near.
	 */
	private async getCachedTokenDecimals(
		omniAddress: OmniAddress,
	): Promise<TokenDecimals | null> {
		const cached = this.tokenDecimalsCache.get(omniAddress);
		if (cached !== undefined) {
			return cached;
		}

		const tokenDecimals = await getTokenDecimals(
			this.nearProvider,
			omniAddress,
		);

		if (tokenDecimals !== null) {
			this.tokenDecimalsCache.set(omniAddress, tokenDecimals);
		}

		return tokenDecimals;
	}
}

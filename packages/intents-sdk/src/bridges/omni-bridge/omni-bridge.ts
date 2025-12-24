import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
	getNearNep141MinStorageBalance,
	getNearNep141StorageBalance,
	withTimeout,
} from "@defuse-protocol/internal-utils";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import TTLCache from "@isaacs/ttlcache";
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
	RouteFeeStructures,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalStatus,
} from "../../shared-types";
import { getUnderlyingFee } from "../../lib/estimate-fee";
import {
	TokenNotFoundInDestinationChainError,
	InvalidFeeValueError,
	IntentsNearOmniAvailableBalanceTooLowError,
	OmniWithdrawalApiFeeRequestTimeoutError,
	InsufficientUtxoForOmniBridgeWithdrawalError,
} from "./error";
import {
	MIN_ALLOWED_STORAGE_BALANCE_FOR_INTENTS_NEAR,
	NEAR_NATIVE_ASSET_ID,
	OMNI_BRIDGE_CONTRACT,
	OMNI_STORAGE_MS_BALANCE_CACHE,
} from "./omni-bridge-constants";
import {
	caip2ToChainKind,
	chainKindToCaip2,
	createWithdrawIntentsPrimitive,
	getBridgedToken,
	getAccountOmniStorageBalance,
	validateOmniToken,
	getTokenDecimals,
	isUtxoChain,
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
	readonly route = RouteEnum.OmniBridge;
	protected env: NearIntentsEnv;
	protected nearProvider: providers.Provider;
	protected omniBridgeAPI: OmniBridgeAPI;
	protected solverRelayApiKey: string | undefined;
	protected cachedOmniStorageBalance: {
		lastRequest: number;
		value: Awaited<ReturnType<typeof getAccountOmniStorageBalance>> | null;
	};
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
		this.cachedOmniStorageBalance = {
			lastRequest: 0,
			value: null,
		};
	}

	private is(routeConfig: RouteConfig): boolean {
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
		let omniChainKind: ChainKind | null = null;
		let blockchain: Chain | null = null;
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
		const relayerFee = getUnderlyingFee(
			args.feeEstimation,
			RouteEnum.OmniBridge,
			"relayerFee",
		);
		assert(
			relayerFee >= 0n,
			`Invalid Omni bridge relayer fee: expected >= 0, got ${relayerFee}`,
		);

		let amount = args.withdrawalParams.amount;
		let utxoMaxGasFee = null;
		/**
		 * UTXO withdrawals add protocol + max gas fees to the intent amount since they're paid
		 * from the withdrawn asset, not wrap.near.
		 *
		 * Example with nep141:nbtc.bridge.near (made-up values):
		 * utxoFees = 50 + 50 = 100, relayerFee = 2 (excluded; paid in wrap.near)
		 *
		 * feeInclusive=false:
		 *   - amount = 4000 → intent = 4000 + 100 = 4100 → user receives 4000
		 *
		 * feeInclusive=true:
		 *   - amount = 3898 (4000 − 102) → intent = 3898 + 100 = 3998 → user receives 3898
		 **/
		if (isUtxoChain(omniChainKind)) {
			utxoMaxGasFee = getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.OmniBridge,
				"utxoMaxGasFee",
			);
			const utxoProtocolFee = getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.OmniBridge,
				"utxoProtocolFee",
			);
			assert(
				utxoMaxGasFee !== undefined && utxoMaxGasFee > 0n,
				`Invalid Omni Bridge utxo max gas fee: expected > 0, got ${utxoMaxGasFee}`,
			);
			assert(
				utxoProtocolFee !== undefined && utxoProtocolFee > 0n,
				`Invalid Omni Bridge utxo protocol fee: expected > 0, got ${utxoProtocolFee}`,
			);

			amount += utxoMaxGasFee + utxoProtocolFee;
		}

		intents.push(
			...createWithdrawIntentsPrimitive({
				assetId: args.withdrawalParams.assetId,
				destinationAddress: args.withdrawalParams.destinationAddress,
				amount,
				omniChainKind,
				intentsContract: configsByEnvironment[this.env].contractID,
				nativeFee: relayerFee,
				storageDepositAmount: getUnderlyingFee(
					args.feeEstimation,
					RouteEnum.OmniBridge,
					"storageDepositFee",
				),
				utxoMaxGasFee,
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
			`Invalid Omni Bridge fee: expected > 0, got ${args.feeEstimation.amount}`,
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
		// verifyTransferAmount ensures (amount - fee) > 0 after normalisation.
		// We pass the actual amount and a zero fee to avoid fee-handling differences
		// between different withdrawal types (UTXO transfers vs regular transfers where the fee is paid in wrap.near).
		const normalisationCheckSucceeded = verifyTransferAmount(
			args.amount, // total amount without fee
			0n, // fee
			decimals.origin_decimals,
			decimals.decimals,
		);
		if (normalisationCheckSucceeded === false) {
			const minAmount = getMinimumTransferableAmount(
				decimals.origin_decimals,
				decimals.decimals,
			);
			throw new MinWithdrawalAmountError(minAmount, args.amount, args.assetId);
		}

		const storageBalance = await this.getCachedAccountOmniStorageBalance();

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

		const utxoChainWithdrawal = isUtxoChain(omniChainKind);
		if (utxoChainWithdrawal === false) {
			const relayerFee = getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.OmniBridge,
				"relayerFee",
			);
			// Currently only UTXO chains withdrawals can have 0 relayerFee
			assert(
				getUnderlyingFee(
					args.feeEstimation,
					RouteEnum.OmniBridge,
					"relayerFee",
				) > 0n,
				`Invalid Omni Bridge relayer fee for non UTXO chain withdrawal: expected > 0, got ${relayerFee}`,
			);
		}

		if (utxoChainWithdrawal) {
			// UTXO availability and minimum withdrawal thresholds for UTXO chains are sourced
			// from the Omni Bridge indexer.
			const fee = await withTimeout(
				() =>
					this.omniBridgeAPI.getFee(
						omniAddress(
							ChainKind.Near,
							configsByEnvironment[this.env].contractID,
						),
						omniAddress(omniChainKind, args.destinationAddress),
						omniAddress(ChainKind.Near, assetInfo.contractId),
						args.amount,
					),
				{
					timeout: typeof window !== "undefined" ? 10_000 : 3000,
					errorInstance: new OmniWithdrawalApiFeeRequestTimeoutError(),
				},
			);
			// This adds a safeguard against insufficient UTXOs on the connector contract.
			// It cannot guarantee full protection, there is always a potential race condition—
			// but it helps reduce the chance of withdrawals getting stuck due to missing UTXOs.
			if (fee.insufficient_utxo) {
				throw new InsufficientUtxoForOmniBridgeWithdrawalError(
					assetInfo.blockchain,
				);
			}

			assert(
				fee.min_amount !== null &&
					fee.min_amount !== undefined &&
					BigInt(fee.min_amount) > 0n,
				`Invalid min amount value for a UTXO chain withdrawal: expected > 0, got ${fee.min_amount}`,
			);
			const minAmount = BigInt(fee.min_amount);
			const utxoMaxGasFee = getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.OmniBridge,
				"utxoMaxGasFee",
			);
			const utxoProtocolFee = getUnderlyingFee(
				args.feeEstimation,
				RouteEnum.OmniBridge,
				"utxoProtocolFee",
			);
			assert(
				utxoMaxGasFee !== undefined && utxoMaxGasFee > 0n,
				`Invalid Omni Bridge utxo max gas fee: expected > 0, got ${utxoMaxGasFee}`,
			);
			assert(
				utxoProtocolFee !== undefined && utxoProtocolFee > 0n,
				`Invalid Omni Bridge utxo protocol fee: expected > 0, got ${utxoProtocolFee}`,
			);

			// args.amount is without fee, we need to pass an amount with fee
			const actualAmountWithFee = args.amount + utxoMaxGasFee + utxoProtocolFee;
			if (actualAmountWithFee < minAmount) {
				throw new MinWithdrawalAmountError(
					minAmount,
					actualAmountWithFee,
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

		const fee = await withTimeout(
			() =>
				this.omniBridgeAPI.getFee(
					omniAddress(
						ChainKind.Near,
						configsByEnvironment[this.env].contractID,
					),
					omniAddress(omniChainKind, args.withdrawalParams.destinationAddress),
					omniAddress(ChainKind.Near, assetInfo.contractId),
					args.withdrawalParams.amount,
				),
			{
				timeout: typeof window !== "undefined" ? 10_000 : 3000,
				errorInstance: new OmniWithdrawalApiFeeRequestTimeoutError(),
			},
		);
		// Native token fee can be zero for BTC withdrawals
		if (fee.native_token_fee === null || fee.native_token_fee < 0n) {
			throw new InvalidFeeValueError(
				args.withdrawalParams.assetId,
				fee.native_token_fee,
			);
		}
		const underlyingFees: RouteFeeStructures[RouteEnum["OmniBridge"]] = {
			relayerFee: fee.native_token_fee,
			storageDepositFee: 0n,
		};

		let totalAmountToQuote = fee.native_token_fee;

		const [minStorageBalance, currentStorageBalance] =
			await this.getCachedStorageDepositValue(assetInfo.contractId);

		const storageDepositFee = minStorageBalance - currentStorageBalance;
		if (storageDepositFee > 0n) {
			totalAmountToQuote += storageDepositFee;
			underlyingFees.storageDepositFee = storageDepositFee;
		}

		// withdraw of nep141:wrap.near
		if (args.withdrawalParams.assetId === NEAR_NATIVE_ASSET_ID) {
			return {
				amount: totalAmountToQuote,
				quote: null,
				underlyingFees: {
					[RouteEnum.OmniBridge]: underlyingFees,
				},
			};
		}

		let amount = 0n;
		let quote = null;
		// Skip quoting when native fee = 0 and no storage deposit is needed.
		if (totalAmountToQuote > 0n) {
			quote = await getFeeQuote({
				feeAmount: totalAmountToQuote,
				feeAssetId: NEAR_NATIVE_ASSET_ID,
				tokenAssetId: args.withdrawalParams.assetId,
				logger: args.logger,
				env: this.env,
				quoteOptions: args.quoteOptions,
				solverRelayApiKey: this.solverRelayApiKey,
			});
			amount += BigInt(quote.amount_in);
		}

		// For withdrawals to UTXO chains we also need to take into consideration
		// gas_fee - max amount of tokens that can be spent on gas in a UTXO network (this is maximum possible that can be spent and the actual spent amount can be lower)
		// protocol_fee - constant fee taken by the relayer
		if (isUtxoChain(omniChainKind)) {
			assert(
				fee.gas_fee !== null && fee.gas_fee !== undefined && fee.gas_fee > 0n,
				`Invalid Omni Bridge utxo gas fee: expected > 0, got ${fee.gas_fee}`,
			);
			assert(
				fee.protocol_fee !== null &&
					fee.protocol_fee !== undefined &&
					fee.protocol_fee > 0n,
				`Invalid Omni Bridge utxo protocol fee: expected > 0, got ${fee.protocol_fee}`,
			);

			amount += fee.gas_fee + fee.protocol_fee;
			underlyingFees.utxoMaxGasFee = fee.gas_fee;
			underlyingFees.utxoProtocolFee = fee.protocol_fee;
		}
		return {
			amount,
			quote,
			underlyingFees: {
				[RouteEnum.OmniBridge]: underlyingFees,
			},
		};
	}

	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier {
		const assetInfo = this.makeAssetInfo(
			args.withdrawalParams.assetId,
			args.withdrawalParams.routeConfig,
		);
		assert(assetInfo != null, "Asset is not supported");

		const landingChain =
			args.withdrawalParams.routeConfig != null &&
			"chain" in args.withdrawalParams.routeConfig &&
			args.withdrawalParams.routeConfig.chain !== undefined
				? args.withdrawalParams.routeConfig.chain
				: assetInfo.blockchain;

		return {
			landingChain,
			index: args.index,
			withdrawalParams: args.withdrawalParams,
			tx: args.tx,
		};
	}

	async describeWithdrawal(
		args: WithdrawalIdentifier & { logger?: ILogger },
	): Promise<WithdrawalStatus> {
		const transfer = (
			await this.omniBridgeAPI.getTransfer({
				transactionHash: args.tx.hash,
			})
		)[args.index];

		if (transfer == null || transfer.transfer_message == null) {
			return { status: "pending" };
		}

		const destinationChain = getChain(
			transfer.transfer_message.recipient as OmniAddress,
		);
		let txHash = null;
		if (isEvmChain(destinationChain)) {
			txHash = transfer.finalised?.EVMLog?.transaction_hash;
		} else if (destinationChain === ChainKind.Sol) {
			txHash = transfer.finalised?.Solana?.signature;
		} else if (destinationChain === ChainKind.Btc) {
			// btc_pending_id is not the finalised tx hash. In rare cases, the hash may change
			// if the BTC transfer fails to be submitted. We return fast hash for FE and wait
			// for final one (transfer.finalised?.UtxoLog?.transaction_hash) for BE.
			txHash =
				typeof window !== "undefined"
					? transfer.utxo_transfer?.btc_pending_id
					: transfer.finalised?.UtxoLog?.transaction_hash;
		} else {
			return { status: "completed", txHash: null };
		}

		if (!txHash) {
			return { status: "pending" };
		}

		return { status: "completed", txHash };
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

	/**
	 * Gets cached omni storage balance for near intents
	 */
	private async getCachedAccountOmniStorageBalance(): Promise<
		ReturnType<typeof getAccountOmniStorageBalance>
	> {
		const now = Date.now();
		if (
			this.cachedOmniStorageBalance.lastRequest <
			now - OMNI_STORAGE_MS_BALANCE_CACHE
		) {
			this.cachedOmniStorageBalance.value = await getAccountOmniStorageBalance(
				this.nearProvider,
				configsByEnvironment[this.env].contractID,
			);
			this.cachedOmniStorageBalance.lastRequest = now;
		}
		return this.cachedOmniStorageBalance.value;
	}
}

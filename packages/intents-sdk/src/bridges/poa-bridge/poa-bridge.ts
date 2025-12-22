import {
	assert,
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
	poaBridge,
	utils,
} from "@defuse-protocol/internal-utils";
import TTLCache from "@isaacs/ttlcache";
import {
	InvalidDestinationAddressForWithdrawalError,
	MinWithdrawalAmountError,
	UnsupportedAssetIdError,
} from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	RouteConfig,
	WithdrawalIdentifier,
	WithdrawalParams,
	WithdrawalStatus,
} from "../../shared-types";
import { getUnderlyingFee } from "../../lib/estimate-fee";
import {
	contractIdToCaip2,
	createWithdrawIntentPrimitive,
	toPoaNetwork,
} from "./poa-bridge-utils";
import type { Chain } from "../../lib/caip2";
import { parseDefuseAssetId } from "../../lib/parse-defuse-asset-id";
import { validateAddress } from "../../lib/validateAddress";
import isPoaTokenRoutableThroughOmniBridge from "../../lib/is-poa-token-routable-trough-omni-bridge";

export class PoaBridge implements Bridge {
	readonly route = RouteEnum.PoaBridge;
	protected env: NearIntentsEnv;
	protected routeMigratedPoaTokensThroughOmniBridge: boolean;

	// TTL cache for supported tokens with 30-second TTL
	private supportedTokensCache = new TTLCache<
		string,
		Awaited<ReturnType<typeof poaBridge.httpClient.getSupportedTokens>>
	>({ ttl: 30 * 1000 });

	constructor({
		env,
		routeMigratedPoaTokensThroughOmniBridge,
	}: {
		env: NearIntentsEnv;
		routeMigratedPoaTokensThroughOmniBridge?: boolean;
	}) {
		this.env = env;
		this.routeMigratedPoaTokensThroughOmniBridge =
			routeMigratedPoaTokensThroughOmniBridge ?? false;
	}

	private is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.PoaBridge;
	}

	async supports(
		params: Pick<WithdrawalParams, "assetId" | "routeConfig">,
	): Promise<boolean> {
		if (params.routeConfig != null && !this.is(params.routeConfig)) {
			return false;
		}

		const assetInfo = this.parseAssetId(params.assetId);
		const isValid = assetInfo != null;

		if (!isValid && params.routeConfig != null) {
			throw new UnsupportedAssetIdError(
				params.assetId,
				"`assetId` does not match `routeConfig`.",
			);
		}

		// When the feature flag is enabled, delegate eligible tokens to Omni Bridge
		// unless the user explicitly specified PoA Bridge via routeConfig
		if (
			this.routeMigratedPoaTokensThroughOmniBridge &&
			assetInfo != null &&
			isPoaTokenRoutableThroughOmniBridge(assetInfo.contractId) &&
			params.routeConfig === undefined
		) {
			return false;
		}

		return isValid;
	}

	parseAssetId(assetId: string): ParsedAssetInfo | null {
		const parsed = parseDefuseAssetId(assetId);
		const contractIdSatisfies = parsed.contractId.endsWith(
			`.${configsByEnvironment[this.env].poaTokenFactoryContractID}`,
		);

		if (!contractIdSatisfies) {
			return null;
		}

		let blockchain: Chain;
		try {
			blockchain = contractIdToCaip2(parsed.contractId);
		} catch {
			throw new UnsupportedAssetIdError(
				assetId,
				"Asset belongs to unknown blockchain.",
			);
		}

		return Object.assign(parsed, {
			blockchain,
			bridgeName: BridgeNameEnum.Poa,
			address: "", // todo: derive address (or native)
		});
	}

	createWithdrawalIntents(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation: FeeEstimation;
	}): Promise<IntentPrimitive[]> {
		const relayerFee = getUnderlyingFee(
			args.feeEstimation,
			RouteEnum.PoaBridge,
			"relayerFee",
		);
		assert(
			relayerFee > 0n,
			`Invalid POA bridge relayer fee: expected > 0, got ${relayerFee}`,
		);
		const intent = createWithdrawIntentPrimitive({
			...args.withdrawalParams,
			amount: args.withdrawalParams.amount + relayerFee,
			destinationMemo: args.withdrawalParams.destinationMemo,
		});
		return Promise.resolve([intent]);
	}

	/**
	 * Validates minimum withdrawal amount for POA bridge tokens.
	 * Checks the bridge's supported tokens API to ensure the withdrawal amount
	 * meets the minimum required amount for the specific token and blockchain.
	 * @throws {MinWithdrawalAmountError} If the amount is below the minimum required
	 */
	async validateWithdrawal(args: {
		assetId: string;
		amount: bigint;
		destinationAddress: string;
		logger?: ILogger;
	}): Promise<void> {
		const assetInfo = this.parseAssetId(args.assetId);
		assert(assetInfo != null, "Asset is not supported");

		if (
			validateAddress(args.destinationAddress, assetInfo.blockchain) === false
		) {
			throw new InvalidDestinationAddressForWithdrawalError(
				args.destinationAddress,
				assetInfo.blockchain,
			);
		}

		// Use cached getSupportedTokens to avoid frequent API calls
		const { tokens } = await this.getCachedSupportedTokens(
			[toPoaNetwork(assetInfo.blockchain)],
			args.logger,
		);

		const tokenInfo = tokens.find(
			(token) => token.intents_token_id === args.assetId,
		);

		if (tokenInfo != null) {
			const minWithdrawalAmount = BigInt(tokenInfo.min_withdrawal_amount);

			if (args.amount < minWithdrawalAmount) {
				throw new MinWithdrawalAmountError(
					minWithdrawalAmount,
					args.amount,
					args.assetId,
				);
			}
		}
	}

	async estimateWithdrawalFee(args: {
		withdrawalParams: Pick<WithdrawalParams, "assetId" | "destinationAddress">;
		logger?: ILogger;
	}): Promise<FeeEstimation> {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const estimation = await poaBridge.httpClient.getWithdrawalEstimate(
			{
				token: utils.getTokenAccountId(args.withdrawalParams.assetId),
				address: args.withdrawalParams.destinationAddress,
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				chain: toPoaNetwork(assetInfo.blockchain) as any,
			},
			{
				baseURL: configsByEnvironment[this.env].poaBridgeBaseURL,
				logger: args.logger,
			},
		);
		const relayerFee = BigInt(estimation.withdrawalFee);
		assert(
			relayerFee > 0n,
			`Invalid POA bridge relayer fee: expected > 0, got ${relayerFee}`,
		);
		return {
			amount: relayerFee,
			quote: null,
			underlyingFees: {
				[RouteEnum.PoaBridge]: {
					relayerFee,
				},
			},
		};
	}

	createWithdrawalIdentifier(args: {
		withdrawalParams: WithdrawalParams;
		index: number;
		tx: NearTxInfo;
	}): WithdrawalIdentifier {
		const assetInfo = this.parseAssetId(args.withdrawalParams.assetId);
		assert(assetInfo != null, "Asset is not supported");

		const landingChain = assetInfo.blockchain;

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
		const response = await poaBridge.httpClient.getWithdrawalStatus(
			{
				withdrawal_hash: args.tx.hash,
			},
			{
				baseURL: configsByEnvironment[this.env].poaBridgeBaseURL,
				logger: args.logger,
			},
		);

		// Response list is unsorted, so we match by assetId instead of index
		const withdrawal = findMatchingWithdrawal(
			response.withdrawals,
			args.withdrawalParams.assetId,
		);

		if (withdrawal == null) {
			return { status: "pending" };
		}

		if (withdrawal.status === "PENDING") {
			return { status: "pending" };
		}

		if (withdrawal.status === "COMPLETED") {
			return {
				status: "completed",
				txHash: withdrawal.data.transfer_tx_hash,
			};
		}

		return {
			status: "failed",
			reason: withdrawal.status,
		};
	}

	/**
	 * Gets supported tokens with caching to avoid frequent API calls.
	 * Cache expires after 30 seconds using TTL cache.
	 */
	private async getCachedSupportedTokens(
		chains: string[],
		logger?: ILogger,
	): Promise<
		Awaited<ReturnType<typeof poaBridge.httpClient.getSupportedTokens>>
	> {
		const cacheKey = chains.sort().join(",");

		const cached = this.supportedTokensCache.get(cacheKey);
		if (cached != null) {
			return cached;
		}

		const data = await poaBridge.httpClient.getSupportedTokens(
			{ chains },
			{
				baseURL: configsByEnvironment[this.env].poaBridgeBaseURL,
				logger,
			},
		);

		this.supportedTokensCache.set(cacheKey, data);

		return data;
	}
}

type WithdrawalStatusResponse = Awaited<
	ReturnType<typeof poaBridge.httpClient.getWithdrawalStatus>
>;

/**
 * Finds a withdrawal matching the given assetId.
 *
 * NOTE: Currently only matches by assetId. This means multiple withdrawals
 * of the same token in a single transaction are not supported.
 * POA API doesn't currently support this case either. When support is added,
 * matching could be done by sorting both API results and withdrawal params by
 * amount (fees are equal for same token, so relative ordering is preserved).
 */
function findMatchingWithdrawal(
	withdrawals: WithdrawalStatusResponse["withdrawals"],
	assetId: string,
): WithdrawalStatusResponse["withdrawals"][number] | undefined {
	return withdrawals.find((w) => w.data.defuse_asset_identifier === assetId);
}

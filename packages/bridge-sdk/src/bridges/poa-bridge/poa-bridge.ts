import {
	type ILogger,
	type NearIntentsEnv,
	type RetryOptions,
	configsByEnvironment,
	poaBridge,
	utils,
} from "@defuse-protocol/internal-utils";
import TTLCache from "@isaacs/ttlcache";
import { MinWithdrawalAmountError } from "../../classes/errors";
import { BridgeNameEnum } from "../../constants/bridge-name-enum";
import { RouteEnum } from "../../constants/route-enum";
import type { IntentPrimitive } from "../../intents/shared-types";
import { assert } from "../../lib/assert";
import type {
	Bridge,
	FeeEstimation,
	NearTxInfo,
	ParsedAssetInfo,
	RouteConfig,
	TxInfo,
	WithdrawalParams,
} from "../../shared-types";
import {
	contractIdToCaip2,
	createWithdrawIntentPrimitive,
	toPoaNetwork,
} from "./poa-bridge-utils";

export class PoaBridge implements Bridge {
	protected env: NearIntentsEnv;

	// TTL cache for supported tokens with 30-second TTL
	private supportedTokensCache = new TTLCache<
		string,
		Awaited<ReturnType<typeof poaBridge.httpClient.getSupportedTokens>>
	>({ ttl: 30 * 1000 });

	constructor({ env }: { env: NearIntentsEnv }) {
		this.env = env;
	}

	is(routeConfig: RouteConfig) {
		return routeConfig.route === RouteEnum.PoaBridge;
	}

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
		if (
			parsed.contractId.endsWith(
				`.${configsByEnvironment[this.env].poaTokenFactoryContractID}`,
			)
		) {
			return Object.assign(parsed, {
				blockchain: contractIdToCaip2(parsed.contractId),
				bridgeName: BridgeNameEnum.Poa,
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

	/**
	 * Validates minimum withdrawal amount for POA bridge tokens.
	 * Checks the bridge's supported tokens API to ensure the withdrawal amount
	 * meets the minimum required amount for the specific token and blockchain.
	 * @throws {MinWithdrawalAmountError} If the amount is below the minimum required
	 */
	async validateMinWithdrawalAmount(args: {
		assetId: string;
		amount: bigint;
		logger?: ILogger;
	}): Promise<void> {
		const assetInfo = this.parseAssetId(args.assetId);
		assert(assetInfo != null, "Asset is not supported");

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

		return {
			amount: BigInt(estimation.withdrawalFee),
			quote: null,
		};
	}

	async waitForWithdrawalCompletion(args: {
		tx: NearTxInfo;
		index: number;
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
		logger?: ILogger;
	}): Promise<TxInfo> {
		const withdrawalStatus = await poaBridge.waitForWithdrawalCompletion({
			txHash: args.tx.hash,
			index: args.index,
			signal: args.signal ?? new AbortController().signal,
			retryOptions: args.retryOptions,
			baseURL: configsByEnvironment[this.env].poaBridgeBaseURL,
			logger: args.logger,
		});

		return { hash: withdrawalStatus.destinationTxHash };
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

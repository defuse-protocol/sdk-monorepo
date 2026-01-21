import {
	type ILogger,
	type EnvConfig,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import type { IIntentRelayer } from "../interfaces/intent-relayer";
import type { IntentHash, MultiPayload } from "../shared-types";

export class IntentRelayerPublic implements IIntentRelayer<IntentHash> {
	protected envConfig: EnvConfig;
	protected solverRelayApiKey: string | undefined;

	constructor({
		envConfig,
		solverRelayApiKey,
	}: { envConfig: EnvConfig; solverRelayApiKey?: string }) {
		this.envConfig = envConfig;
		this.solverRelayApiKey = solverRelayApiKey;
	}

	async publishIntent(
		{
			multiPayload,
			quoteHashes,
		}: {
			multiPayload: MultiPayload;
			quoteHashes?: string[];
		},
		ctx: { logger?: ILogger } = {},
	): Promise<IntentHash> {
		// biome-ignore lint/style/noNonNullAssertion: Array is guaranteed to have at least one element
		return (
			await this.publishIntents(
				{
					multiPayloads: [multiPayload],
					quoteHashes: quoteHashes ?? [],
				},
				ctx,
			)
		)[0]!;
	}

	// how to pass additional params like quoteHashes or some relay specific params ?
	async publishIntents(
		{
			multiPayloads,
			quoteHashes,
		}: {
			multiPayloads: MultiPayload[];
			quoteHashes: string[];
		},
		ctx: { logger?: ILogger } = {},
	): Promise<IntentHash[]> {
		const result = await solverRelay.publishIntents(
			{
				quote_hashes: quoteHashes,
				signed_datas: multiPayloads,
			},
			{
				baseURL: this.envConfig.solverRelayBaseURL,
				logger: ctx.logger,
				solverRelayApiKey: this.solverRelayApiKey,
			},
		);
		if (result.isOk()) {
			return result.unwrap() as IntentHash[];
		}

		throw result.unwrapErr();
	}

	async waitForSettlement(
		ticket: IntentHash,
		ctx: { logger?: ILogger; signal?: AbortSignal } = {},
	): Promise<{ tx: NearTxInfo }> {
		const result = await solverRelay.waitForIntentSettlement({
			intentHash: ticket,
			signal: ctx.signal,
			baseURL: this.envConfig.solverRelayBaseURL,
			logger: ctx.logger,
			solverRelayApiKey: this.solverRelayApiKey,
		});
		return {
			tx: {
				hash: result.txHash,
				// Usually relayer's account id is the verifying contract (`intents.near`),
				// but it is not set in stone and may change in the future.
				accountId: this.envConfig.contractID,
			},
		};
	}
}

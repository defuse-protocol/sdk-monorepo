import {
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import type { IIntentRelayer } from "../interfaces/intent-relayer";
import type { IntentHash, MultiPayload } from "../shared-types";

export class IntentRelayerPublic implements IIntentRelayer<IntentHash> {
	protected env: NearIntentsEnv;
	protected solverRelayApiKey: string | undefined;

	constructor({
		env,
		solverRelayApiKey,
	}: { env: NearIntentsEnv; solverRelayApiKey?: string }) {
		this.env = env;
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
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
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
				baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
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
		ctx: { logger?: ILogger } = {},
	): Promise<{ tx: NearTxInfo }> {
		const result = await solverRelay.waitForIntentSettlement({
			intentHash: ticket,
			signal: new AbortController().signal,
			baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
			logger: ctx.logger,
			solverRelayApiKey: this.solverRelayApiKey,
		});
		return {
			tx: {
				hash: result.txHash,
				// Usually relayer's account id is the verifying contract (`intents.near`),
				// but it is not set in stone and may change in the future.
				accountId: configsByEnvironment[this.env].contractID,
			},
		};
	}
}

import {
	type NearIntentsEnv,
	configsByEnvironment,
	solverRelay,
} from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import type { IIntentRelayer } from "../interfaces/intent-relayer";
import type { IntentHash, MultiPayload } from "../shared-types";

export class IntentRelayerPublic implements IIntentRelayer<IntentHash> {
	protected env: NearIntentsEnv;

	constructor({ env }: { env: NearIntentsEnv }) {
		this.env = env;
	}

	async publishIntent({
		multiPayload,
		quoteHashes,
	}: {
		multiPayload: MultiPayload;
		quoteHashes?: string[];
	}): Promise<IntentHash> {
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		return (
			await this.publishIntents({
				multiPayloads: [multiPayload],
				quoteHashes: quoteHashes ?? [],
			})
		)[0]!;
	}

	// как прокидывать доп. параметры, например, quoteHashes (или специфичные параметры для каждого релея?)
	async publishIntents({
		multiPayloads,
		quoteHashes,
	}: {
		multiPayloads: MultiPayload[];
		quoteHashes: string[];
	}): Promise<IntentHash[]> {
		const a = await solverRelay.publishIntents(
			{
				quote_hashes: quoteHashes,
				signed_datas: multiPayloads,
			},
			{ baseURL: configsByEnvironment[this.env].solverRelayBaseURL },
		);
		if (a.isOk()) {
			return a.unwrap() as IntentHash[];
		}

		throw a.unwrapErr();
	}

	async waitForSettlement(ticket: IntentHash): Promise<{ tx: NearTxInfo }> {
		const result = await solverRelay.waitForIntentSettlement({
			intentHash: ticket,
			signal: new AbortController().signal,
			baseURL: configsByEnvironment[this.env].solverRelayBaseURL,
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

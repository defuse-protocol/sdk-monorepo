import { publishIntents } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/publishIntents";
import { waitForIntentSettlement } from "@defuse-protocol/defuse-sdk/dist/sdk/solverRelay/waitForIntentSettlement";
import type { NearTxInfo } from "../../shared-types.ts";
import type { IIntentRelayer } from "../interfaces/intent-relayer.ts";
import type { IntentHash, MultiPayload } from "../shared-types.ts";

export class IntentRelayerPublic implements IIntentRelayer<IntentHash> {
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
		const a = await publishIntents({
			quote_hashes: quoteHashes,
			signed_datas: multiPayloads,
		});
		if (a.isOk()) {
			return a.unwrap() as IntentHash[];
		}

		throw new Error(a.unwrapErr().reason);
	}

	async waitForSettlement(ticket: IntentHash): Promise<{ tx: NearTxInfo }> {
		const result = await waitForIntentSettlement(
			AbortSignal.timeout(30000),
			ticket,
		);
		if (result.status === "NOT_FOUND_OR_NOT_VALID") {
			throw new Error(
				`Intent not found or not valid intent = ${result.intentHash}`,
			);
		}
		return { tx: { hash: result.txHash, accountId: "intents.near" } };
	}
}

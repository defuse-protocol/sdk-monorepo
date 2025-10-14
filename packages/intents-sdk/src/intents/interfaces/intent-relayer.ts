import type { ILogger } from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import type { MultiPayload, RelayParamsDefault } from "../shared-types";

export interface IIntentRelayer<Ticket, RelayParams = RelayParamsDefault> {
	/**
	 * Publishes a single intent to the relayer.
	 * @param params - The relay parameters including the signed multi-payload
	 * @param ctx - Optional context with logger
	 * @returns A ticket (typically an intent hash) for tracking the intent
	 */
	publishIntent(
		params: RelayParams,
		ctx?: { logger?: ILogger },
	): Promise<Ticket>;

	/**
	 * Publishes multiple intents atomically to the relayer.
	 * All intents will be executed together or not at all.
	 * @param params - Parameters including array of multi-payloads and quote hashes
	 * @param ctx - Optional context with logger
	 * @returns Array of tickets (typically intent hashes) for tracking the intents
	 */
	publishIntents(
		params: {
			multiPayloads: MultiPayload[];
			quoteHashes: string[];
		},
		ctx?: { logger?: ILogger },
	): Promise<Ticket[]>;

	/**
	 * Waits for an intent to be settled on-chain.
	 * @param ticket - The ticket returned from publishIntent
	 * @param ctx - Optional context with logger
	 * @returns Transaction information once settled
	 */
	waitForSettlement(
		ticket: Ticket,
		ctx?: { logger?: ILogger },
	): Promise<{ tx: NearTxInfo }>;
}

import {
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
} from "@defuse-protocol/internal-utils";
import type { IntentComposition, NearTxInfo } from "../../shared-types";
import { computeIntentHash } from "../intent-hash";
import { defaultIntentPayloadFactory } from "../intent-payload-factory";
import type { IIntentExecuter } from "../interfaces/intent-executer";
import type { IIntentRelayer } from "../interfaces/intent-relayer";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type {
	IntentHash,
	IntentPayload,
	IntentPayloadFactory,
	IntentRelayParamsFactory,
	MultiPayload,
	RelayParamsDefault,
} from "../shared-types";

/**
 * Hook function called before publishing an intent.
 * Can be used for persistence, logging, analytics, etc.
 *
 * @param intentData - The intent data about to be published
 * @returns A promise that resolves when the hook is complete
 */
export type OnBeforePublishIntentHook<
	RelayParams = Omit<RelayParamsDefault, "multiPayload">,
> = (intentData: {
	intentHash: IntentHash;
	intentPayload: IntentPayload;
	multiPayload: MultiPayload;
	relayParams: RelayParams;
}) => Promise<void> | void;

export class IntentExecuter<Ticket> implements IIntentExecuter<Ticket> {
	protected env: NearIntentsEnv;
	protected logger: ILogger | undefined;
	protected intentPayloadFactory: IntentPayloadFactory | undefined;
	protected intentSigner: IIntentSigner;
	protected intentRelayer: IIntentRelayer<Ticket>;
	protected onBeforePublishIntent: OnBeforePublishIntentHook | undefined;

	constructor(args: {
		env: NearIntentsEnv;
		logger?: ILogger;
		intentPayloadFactory?: IntentPayloadFactory;
		intentRelayer: IIntentRelayer<Ticket>;
		intentSigner: IIntentSigner;
		onBeforePublishIntent?: OnBeforePublishIntentHook;
	}) {
		this.env = args.env;
		this.logger = args.logger;
		this.intentPayloadFactory = args.intentPayloadFactory;
		this.intentRelayer = args.intentRelayer;
		this.intentSigner = args.intentSigner;
		this.onBeforePublishIntent = args.onBeforePublishIntent;
	}

	async signAndSendIntent({
		relayParams: relayParamsFactory,
		composition,
		...intentParams
	}: {
		relayParams?: IntentRelayParamsFactory;
		composition?: IntentComposition;
	} & Partial<Parameters<IntentPayloadFactory>[0]>): Promise<{
		ticket: Ticket;
	}> {
		const verifyingContract = configsByEnvironment[this.env].contractID;

		let intentPayload = defaultIntentPayloadFactory({
			verifying_contract: verifyingContract,
			...intentParams,
		});

		if (this.intentPayloadFactory) {
			intentPayload = await mergeIntentPayloads(
				intentPayload,
				this.intentPayloadFactory,
			);
		}

		const multiPayload = await this.intentSigner.signIntent(intentPayload);
		const relayParams = relayParamsFactory ? await relayParamsFactory() : {};

		// Call the hook before publishing if provided
		if (this.onBeforePublishIntent) {
			const intentHash = await computeIntentHash(multiPayload);
			await this.onBeforePublishIntent({
				intentHash,
				intentPayload,
				multiPayload,
				relayParams,
			});
		}

		// Compose with pre-signed intents if provided
		const composedPayloads = composeMultiPayloads(multiPayload, composition);

		// If we have multiple payloads (composition), publish them atomically
		if (composedPayloads.length > 1) {
			const quoteHashes =
				(relayParams as { quoteHashes?: string[] }).quoteHashes ?? [];

			// Publish all payloads atomically using the relayer's batch method
			const tickets = await this.intentRelayer.publishIntents(
				{
					multiPayloads: composedPayloads,
					quoteHashes,
				},
				{ logger: this.logger },
			);

			// Calculate the index of the newly created intent
			// Order is: [prepend...] -> newPayload -> [append...]
			const prependCount = composition?.prepend?.length ?? 0;
			const newIntentTicket = tickets[prependCount];

			// Return the ticket for the newly created intent
			// Note: All composed intents execute atomically, but we return the main one
			return { ticket: newIntentTicket as Ticket };
		}

		// Single intent - use regular publish method
		const ticket = await this.intentRelayer.publishIntent(
			{
				multiPayload,
				...relayParams,
			},
			{ logger: this.logger },
		);

		return { ticket };
	}

	async waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }> {
		return this.intentRelayer.waitForSettlement(ticket, {
			logger: this.logger,
		});
	}
}

async function mergeIntentPayloads(
	basePayload: IntentPayload,
	intentPayloadFactory: IntentPayloadFactory,
): Promise<IntentPayload> {
	const customPayload = await intentPayloadFactory(basePayload);
	const customPayloadIntents = customPayload.intents ?? [];

	return {
		...basePayload,
		...customPayload,
		intents: Array.from(
			new Set([...customPayloadIntents, ...basePayload.intents]),
		),
	};
}

/**
 * Composes a newly signed MultiPayload with pre-signed intents.
 * Returns an array of MultiPayloads ordered for atomic execution.
 *
 * @param newPayload - The newly signed MultiPayload
 * @param composition - Optional composition configuration with prepend/append intents
 * @returns Array of MultiPayloads in execution order
 */
function composeMultiPayloads(
	newPayload: MultiPayload,
	composition?: IntentComposition,
): MultiPayload[] {
	if (!composition) {
		return [newPayload];
	}

	const result: MultiPayload[] = [];

	// Add prepended intents first
	if (composition.prepend && composition.prepend.length > 0) {
		result.push(...composition.prepend);
	}

	// Add the new payload
	result.push(newPayload);

	// Add appended intents last
	if (composition.append && composition.append.length > 0) {
		result.push(...composition.append);
	}

	return result;
}

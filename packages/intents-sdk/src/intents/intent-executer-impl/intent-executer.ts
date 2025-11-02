import {
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
} from "@defuse-protocol/internal-utils";
import type { SignedIntentsComposition, NearTxInfo } from "../../shared-types";
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
		signedIntents,
		...intentParams
	}: {
		relayParams?: IntentRelayParamsFactory;
		signedIntents?: SignedIntentsComposition;
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
		const composedPayloads = composeMultiPayloads(multiPayload, signedIntents);

		// If we have multiple payloads (with signed intents), publish them atomically
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
			// Order is: [before...] -> newPayload -> [after...]
			const beforeCount = signedIntents?.before?.length ?? 0;
			const newIntentTicket = tickets[beforeCount];

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

  const protectedFields = ['verifying_contract', 'deadline', 'nonce'] as const;
  const customPayload = await intentPayloadFactory(basePayload);
	const customPayloadIntents = customPayload.intents ?? [];

  for (const field of protectedFields) {
               if (customPayload[field] !== undefined &&
                       customPayload[field] !== basePayload[field]) {
                       throw new Error(
                               `Security violation: ${field} cannot be overridden by custom factory. ` +
                               `Expected: ${basePayload[field]}, Got: ${customPayload[field]}`
                       );
               }
       }



	return {
		...basePayload,
		...customPayload,
	 verifying_contract: basePayload.verifying_contract,
   deadline: basePayload.deadline,
   nonce: basePayload.nonce,
	 intents: Array.from(
			new Set([...customPayloadIntents, ...basePayload.intents]),
		),
	};
}

/**
 * Composes a new MultiPayload with pre-signed intents for atomic execution.
 *
 * @param newPayload - The newly signed MultiPayload
 * @param signedIntents - Optional configuration with before/after intents
 * @returns Array of MultiPayloads in execution order: [before...] -> newPayload -> [after...]
 */
function composeMultiPayloads(
	newPayload: MultiPayload,
	signedIntents?: SignedIntentsComposition,
): MultiPayload[] {
	if (!signedIntents) {
		return [newPayload];
	}

	const result: MultiPayload[] = [];

	// Add "before" intents first
	if (signedIntents.before && signedIntents.before.length > 0) {
		result.push(...signedIntents.before);
	}

	// Add the new payload
	result.push(newPayload);

	// Add "after" intents last
	if (signedIntents.after && signedIntents.after.length > 0) {
		result.push(...signedIntents.after);
	}

	return result;
}

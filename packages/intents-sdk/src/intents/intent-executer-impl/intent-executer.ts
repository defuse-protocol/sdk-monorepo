import {
	type ILogger,
	type NearIntentsEnv,
	configsByEnvironment,
} from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
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
		...intentParams
	}: {
		relayParams?: IntentRelayParamsFactory;
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

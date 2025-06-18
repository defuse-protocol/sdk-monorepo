import type { NearTxInfo } from "../../shared-types.ts";
import { defaultIntentPayloadFactory } from "../intent-payload-factory.ts";
import type { IIntentExecuter } from "../interfaces/intent-executer.ts";
import type { IIntentRelayer } from "../interfaces/intent-relayer.ts";
import type { IIntentSigner } from "../interfaces/intent-signer.ts";
import type {
	IntentPayloadFactory,
	IntentRelayParamsFactory,
} from "../shared-types.ts";

export class IntentExecuter<Ticket> implements IIntentExecuter<Ticket> {
	protected intentPayloadFactory: IntentPayloadFactory | undefined;
	protected intentSigner: IIntentSigner;
	protected intentRelayer: IIntentRelayer<Ticket>;

	constructor(args: {
		intentPayloadFactory?: IntentPayloadFactory;
		intentRelayer: IIntentRelayer<Ticket>;
		intentSigner: IIntentSigner;
	}) {
		this.intentPayloadFactory = args.intentPayloadFactory;
		this.intentRelayer = args.intentRelayer;
		this.intentSigner = args.intentSigner;
	}

	async signAndSendIntent({
		relayParams: relayParamsFactory,
		...intentParams
	}: Parameters<IntentPayloadFactory>[0] & {
		relayParams?: IntentRelayParamsFactory;
	}): Promise<{ ticket: Ticket }> {
		let intentPayload = defaultIntentPayloadFactory(intentParams);
		intentPayload = this.intentPayloadFactory
			? // We allow omitting properties, that's why we pass the result through the factory again
				defaultIntentPayloadFactory(
					await this.intentPayloadFactory(intentPayload),
				)
			: intentPayload;

		const multiPayload = await this.intentSigner.signIntent(intentPayload);
		const relayParams = relayParamsFactory ? await relayParamsFactory() : {};
		const ticket = await this.intentRelayer.publishIntent({
			multiPayload,
			...relayParams,
		});

		return { ticket };
	}

	async waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }> {
		return this.intentRelayer.waitForSettlement(ticket);
	}
}

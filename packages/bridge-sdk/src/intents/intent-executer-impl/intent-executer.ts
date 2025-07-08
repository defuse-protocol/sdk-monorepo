import {
	type NearIntentsEnv,
	configsByEnvironment,
} from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import { defaultIntentPayloadFactory } from "../intent-payload-factory";
import type { IIntentExecuter } from "../interfaces/intent-executer";
import type { IIntentRelayer } from "../interfaces/intent-relayer";
import type { IIntentSigner } from "../interfaces/intent-signer";
import type {
	IntentPayloadFactory,
	IntentRelayParamsFactory,
} from "../shared-types";

export class IntentExecuter<Ticket> implements IIntentExecuter<Ticket> {
	protected env: NearIntentsEnv;
	protected intentPayloadFactory: IntentPayloadFactory | undefined;
	protected intentSigner: IIntentSigner;
	protected intentRelayer: IIntentRelayer<Ticket>;

	constructor(args: {
		env: NearIntentsEnv;
		intentPayloadFactory?: IntentPayloadFactory;
		intentRelayer: IIntentRelayer<Ticket>;
		intentSigner: IIntentSigner;
	}) {
		this.env = args.env;
		this.intentPayloadFactory = args.intentPayloadFactory;
		this.intentRelayer = args.intentRelayer;
		this.intentSigner = args.intentSigner;
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
		intentPayload = this.intentPayloadFactory
			? // We allow omitting properties, that's why we pass the result through the factory again
				defaultIntentPayloadFactory({
					verifying_contract: verifyingContract,
					...(await this.intentPayloadFactory(intentPayload)),
				})
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

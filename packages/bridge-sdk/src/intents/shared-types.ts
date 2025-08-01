import type { Intent, MultiPayload } from "@defuse-protocol/contract-types";

export type IntentPrimitive = Intent;

export interface IntentPayload {
	verifying_contract: string;
	deadline: string;
	nonce: string;
	intents: IntentPrimitive[];
	signer_id: string | undefined;
}

export type IntentPayloadFactory = (
	intentParams: IntentPayload,
) => Promise<Partial<IntentPayload>> | Partial<IntentPayload>;

export type { MultiPayload };

export type IntentHash = string;

export interface RelayParamsDefault {
	multiPayload: MultiPayload;
	quoteHashes?: string[];
}

export type IntentRelayParamsFactory<
	RelayParams = Omit<RelayParamsDefault, "multiPayload">,
> = () => RelayParams | Promise<RelayParams>;

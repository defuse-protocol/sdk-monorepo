import type { IIntentSigner } from "../interfaces/intent-signer";
import {
	IntentSignerNearKeypair,
	type IntentSignerNearKeypairConfig,
} from "./intent-signer-near-keypair";
import {
	IntentSignerNEP413,
	type IntentSignerNEP413Config,
} from "./intent-signer-nep413";
import {
	IntentSignerViem,
	type IntentSignerViemConfig,
} from "./intent-signer-viem";

export function createIntentSignerNEP413(
	config: IntentSignerNEP413Config,
): IIntentSigner {
	return new IntentSignerNEP413(config);
}

export function createIntentSignerNearKeyPair(
	config: IntentSignerNearKeypairConfig,
): IIntentSigner {
	return new IntentSignerNearKeypair(config);
}

export function createIntentSignerViem(
	config: IntentSignerViemConfig,
): IIntentSigner {
	return new IntentSignerViem(config);
}

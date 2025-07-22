import {
	IntentSignerNEP413,
	type IntentSignerNEP413Config,
} from "./intent-signer-nep413";
import type { IIntentSigner } from "../interfaces/intent-signer";
import {
	IntentSignerViem,
	type IntentSignerViemConfig,
} from "./intent-signer-viem";
import {
	IntentSignerNearKeypair,
	type IntentSignerNearKeypairConfig,
} from "./intent-signer-near-keypair";

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

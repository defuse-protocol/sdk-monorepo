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
): IntentSignerNEP413 {
	return new IntentSignerNEP413(config);
}

export function createIntentSignerNearKeyPair(
	config: IntentSignerNearKeypairConfig,
): IntentSignerNearKeypair {
	return new IntentSignerNearKeypair(config);
}

export function createIntentSignerViem(
	config: IntentSignerViemConfig,
): IntentSignerViem {
	return new IntentSignerViem(config);
}

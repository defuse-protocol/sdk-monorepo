import type { MultiPayload } from "@defuse-protocol/contract-types";
import { base58 } from "@scure/base";
import { computeSignedNep413Hash } from "./intent-hashes/nep413";
import { computeSignedErc191Hash } from "./intent-hashes/erc191";
import { computeSignedTip191Hash } from "./intent-hashes/tip191";
import { computeSignedRawEd25519Hash } from "./intent-hashes/raw-ed25519";
import { computeSignedWebAuthnHash } from "./intent-hashes/webauthn";
import { computeSignedTonConnectHash } from "./intent-hashes/ton-connect";
import { computeSignedSep53Hash } from "./intent-hashes/sep53";
import type { IntentHash } from "./shared-types";

/**
 * Computes the intent hash for a MultiPayload locally, without needing to publish it.
 * This follows the same logic as the NEAR intents repository:
 * https://github.com/near/intents/blob/11fe297dddd50936b297485e147548f5f9a69200/core/src/payload/multi.rs#L56
 *
 * Different standards use different hash functions:
 * - NEP-413: SHA-256 (of Borsh-serialized payload)
 * - ERC-191: Keccak256 (of prefixed message)
 * - TIP-191: Keccak256 (of prefixed message)
 * - Raw Ed25519: SHA-256 (of raw message)
 * - WebAuthn: SHA-256 (of raw message)
 * - TON Connect: SHA-256 (of formatted message)
 * - SEP-53: SHA-256 (of prefixed message)
 *
 * @param signed - The multi-payload to hash
 * @returns 32-byte hash as Uint8Array
 */
export async function computeMultiPayloadHashBytes(
	signed: MultiPayload,
): Promise<Uint8Array> {
	const { standard } = signed;
	switch (standard) {
		case "nep413":
			return computeSignedNep413Hash(
				signed as Extract<MultiPayload, { standard: "nep413" }>,
			);
		case "erc191":
			return computeSignedErc191Hash(
				signed as Extract<MultiPayload, { standard: "erc191" }>,
			);
		case "tip191":
			return computeSignedTip191Hash(
				signed as Extract<MultiPayload, { standard: "tip191" }>,
			);
		case "raw_ed25519":
			return computeSignedRawEd25519Hash(
				signed as Extract<MultiPayload, { standard: "raw_ed25519" }>,
			);
		case "webauthn":
			return computeSignedWebAuthnHash(
				signed as Extract<MultiPayload, { standard: "webauthn" }>,
			);
		case "ton_connect":
			return computeSignedTonConnectHash(
				signed as Extract<MultiPayload, { standard: "ton_connect" }>,
			);
		case "sep53":
			return computeSignedSep53Hash(
				signed as Extract<MultiPayload, { standard: "sep53" }>,
			);
		default:
			throw new Error(`Unknown payload standard: ${signed.standard}`);
	}
}

export async function computeMultiPayloadHash(
	multiPayload: MultiPayload,
): Promise<IntentHash> {
	const hashBytes = await computeMultiPayloadHashBytes(multiPayload);
	return base58.encode(hashBytes);
}

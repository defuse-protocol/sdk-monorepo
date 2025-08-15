import type {
	Intent,
	Nep413DefuseMessageFor_DefuseIntents,
} from "@defuse-protocol/contract-types";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";
import { config } from "../config";
import type { IntentsUserId } from "../types/intentsUserId";
import type { WalletMessage } from "../types/walletMessage";
import { assert } from "./assert";

/**
 * @param tokenDeltas
 * @param signerId
 * @param deadlineTimestamp Unix timestamp in milliseconds
 * @param referral
 * @param memo
 * @param appFee
 * @param appFeeRecipient
 */
export function makeInnerSwapMessage({
	tokenDeltas,
	signerId,
	deadlineTimestamp,
	referral,
	memo,
	appFee,
	appFeeRecipient,
}: {
	tokenDeltas: [string, bigint][];
	signerId: IntentsUserId;
	deadlineTimestamp: number;
	referral?: string;
	memo?: string;
	appFee: [string, bigint][];
	appFeeRecipient: string;
}): Nep413DefuseMessageFor_DefuseIntents {
	const tokenDiff: Record<string, string> = {};
	const tokenDiffNum: Record<string, bigint> = {};

	const intents: Intent[] = [
		{
			intent: "token_diff",
			diff: tokenDiff,
			referral,
			memo,
		},
	];

	if (appFee.length) {
		intents.push({
			intent: "transfer",
			tokens: Object.fromEntries(
				appFee.map(([token, amount]) => [token, amount.toString()]),
			),
			receiver_id: appFeeRecipient,
			memo: "APP_FEE",
		});
	}

	for (const [token, amount] of tokenDeltas) {
		tokenDiffNum[token] ??= 0n;
		tokenDiffNum[token] += amount;
		// biome-ignore lint/style/noNonNullAssertion: it is checked above
		tokenDiff[token] = tokenDiffNum[token]!.toString();
	}

	if (Object.keys(tokenDiff).length === 0) {
		return {
			deadline: new Date(deadlineTimestamp).toISOString(),
			intents: [],
			signer_id: signerId,
		};
	}

	return {
		deadline: new Date(deadlineTimestamp).toISOString(),
		intents,
		signer_id: signerId,
	};
}

export function makeSwapMessage({
	innerMessage,
	nonce = randomDefuseNonce(),
}: {
	innerMessage: Nep413DefuseMessageFor_DefuseIntents;
	nonce?: Uint8Array;
}): WalletMessage {
	const payload = {
		signer_id: innerMessage.signer_id,
		verifying_contract: config.env.contractID,
		deadline: innerMessage.deadline,
		nonce: base64.encode(nonce),
		intents: innerMessage.intents,
	};
	const payloadSerialized = JSON.stringify(payload);
	const payloadBytes = new TextEncoder().encode(payloadSerialized);

	return {
		NEP413: {
			message: JSON.stringify(innerMessage),
			// This is who will be verifying the message
			recipient: config.env.contractID,
			nonce,
		},
		ERC191: {
			message: JSON.stringify(payload, null, 2),
		},
		SOLANA: {
			message: payloadBytes,
		},
		STELLAR: {
			message: JSON.stringify(payload, null, 2),
		},
		WEBAUTHN: {
			challenge: makeChallenge(payloadBytes),
			payload: payloadSerialized,
			parsedPayload: payload,
		},
		TON_CONNECT: {
			message: {
				type: "text",
				text: JSON.stringify(payload, null, 2),
			},
		},
	};
}

export function makeEmptyMessage({
	signerId,
	deadlineTimestamp,
	nonce = randomDefuseNonce(),
}: {
	signerId: IntentsUserId;
	deadlineTimestamp: number;
	nonce?: Uint8Array;
}): WalletMessage {
	const innerMessage: Nep413DefuseMessageFor_DefuseIntents = {
		deadline: new Date(deadlineTimestamp).toISOString(),
		intents: [],
		signer_id: signerId,
	};

	return makeSwapMessage({
		innerMessage,
		nonce,
	});
}

export function randomDefuseNonce(): Uint8Array {
	return randomBytes(32);
}

function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Converts UTF-8 string to bytes for WebAuthn challenge
 */
export function makeChallenge(payload: Uint8Array): Uint8Array {
	// It's possible to use native crypto, but it's async, and this would break existing flow:
	// await crypto.subtle.digest("SHA-256", messageBytes)
	const hash = sha256(payload);
	return new Uint8Array(hash);
}

export function makeInnerTransferMessage({
	tokenDeltas,
	signerId,
	deadlineTimestamp,
	receiverId,
	memo,
}: {
	tokenDeltas: [string, bigint][];
	signerId: IntentsUserId;
	deadlineTimestamp: number;
	receiverId: string;
	memo?: string;
}): Nep413DefuseMessageFor_DefuseIntents {
	const tokens: Record<string, string> = {};
	const seenTokens = new Set<string>();

	for (const [token, amount] of tokenDeltas) {
		assert(!seenTokens.has(token), `Duplicate token found: ${token}`);
		seenTokens.add(token);
		assert(
			amount > 0n,
			`Transfer amount must be positive, got: ${amount} for token ${token}`,
		);
		tokens[token] = amount.toString();
	}

	return {
		deadline: new Date(deadlineTimestamp).toISOString(),
		intents: [
			{
				intent: "transfer",
				tokens,
				receiver_id: receiverId,
				...(memo ? { memo } : {}),
			},
		],
		signer_id: signerId,
	};
}

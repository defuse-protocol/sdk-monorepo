import { describe, expect, it } from "vitest";
import {
	DEFAULT_NONCE_DEADLINE_OFFSET_MS,
	defaultIntentPayloadFactory,
} from "./intent-payload-factory";
import {
	VersionedNonceBuilder,
	type SaltedNonceValue,
} from "./expirable-nonce";

function decodeNonceDeadlineMs(nonce: string): number {
	const decoded = VersionedNonceBuilder.decodeNonce(nonce);
	const saltedNonce = decoded.value as SaltedNonceValue;
	return Number(saltedNonce.inner.deadline / 1_000_000n);
}

describe("defaultIntentPayloadFactory", () => {
	const salt = Uint8Array.from([1, 2, 3, 4]);

	it("extends nonce deadline when deadline is provided", () => {
		const deadline = "2026-01-01T00:00:00.000Z";
		const payload = defaultIntentPayloadFactory(salt, {
			verifying_contract: "intents.near",
			deadline,
		});

		expect(decodeNonceDeadlineMs(payload.nonce)).toBe(
			new Date(deadline).getTime() + DEFAULT_NONCE_DEADLINE_OFFSET_MS,
		);
	});

	it("extends nonce deadline when using default payload deadline", () => {
		const payload = defaultIntentPayloadFactory(salt, {
			verifying_contract: "intents.near",
		});

		const payloadDeadlineMs = new Date(payload.deadline).getTime();
		const nonceDeadlineMs = decodeNonceDeadlineMs(payload.nonce);
		expect(nonceDeadlineMs - payloadDeadlineMs).toBe(
			DEFAULT_NONCE_DEADLINE_OFFSET_MS,
		);
	});
});

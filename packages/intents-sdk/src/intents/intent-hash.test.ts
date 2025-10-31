import { describe, expect, it } from "vitest";
import { computeIntentHash } from "./intent-hash";
import type { MultiPayload } from "./shared-types";

describe("computeIntentHash()", () => {
	it("computes hash for NEP-413 standard", async () => {
		const multiPayload: MultiPayload = {
			standard: "nep413",
			payload: {
				recipient: "intents.near",
				nonce: "Bw6gXE7I/iTjzSRraN/TOZRPFr/8E4Y19NI7f4pj7Js=",
				message:
					'{"deadline":"2025-07-30T13:01:54.991Z","intents":[],"signer_id":"d3b7f5e2041835a9329d9ab0fcf29685a63f40f43ae92b31808529b39da19743"}',
			},
			public_key: "ed25519:FFTikSK68qzR3tbsWgvm4pZQExb1SmaLzf9Q8EGQ5X9C",
			signature:
				"ed25519:2NL2GDuo1YRBbknqZ8AP7dVHusZuNLn5pDk2ikDag9cnJgnqR2xk46inN3WwG5bn6ahm8rBevVqnxQc5waNS8DwK",
		};

		const hash = await computeIntentHash(multiPayload);
		expect(hash).toEqual("9gsq212UbkVifADMGC3Mdj7Gdhy7W7bw9ipnCqMtap5C");
	});

	it("computes hash for ERC-191 standard", async () => {
		const multiPayload: MultiPayload = {
			standard: "erc191",
			payload:
				'{"signer_id":"0x5a95b4a393f0a8def7ac46907e1fb0782cd3538a","verifying_contract":"intents.near","deadline":"2025-07-30T12:57:16.264Z","nonce":"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=","intents":[]}',
			signature:
				"secp256k1:CvkU692XuyALYxSDvrpFviJozq5DPrwADzqqV6DA1DDAPy93PaBvWPEngZzREqJetbLpBEmYSV7Joo61yXKXAoJ3i",
		};

		const hash = await computeIntentHash(multiPayload);
		expect(hash).toEqual("7YaoCk1j9rSrM7kw3ip33ySyJLtqWVxFRQHW5PeWMKAf");
	});

	it("computes hash for ERC-191 standard with non ASCII string (café)", async () => {
		const multiPayload: MultiPayload = {
			standard: "erc191",
			payload:
				'{"signer_id":"0x5a95b4a393f0a8def7ac46907e1fb0782cd3538a","verifying_contract":"intents.near","deadline":"2025-07-30T12:57:16.264Z","nonce":"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=","intents":[{"amount":"100000000","intent":"ft_withdraw","memo":"café","receiver_id":"btc.omft.near","token":"btc.omft.near"}]}',
			signature:
				"secp256k1:CvkU692XuyALYxSDvrpFviJozq5DPrwADzqqV6DA1DDAPy93PaBvWPEngZzREqJetbLpBEmYSV7Joo61yXKXAoJ3i",
		};

		const hash = await computeIntentHash(multiPayload);
		expect(hash).toEqual("APvv5zuHPLuSG4xwe24FiyCdiWVXVbkyfkXBBjGy5xJL");
	});

	it("computes hash for TIP-191 standard", async () => {
		const multiPayload: MultiPayload = {
			standard: "tip191",
			payload:
				'{"signer_id":"0x5a95b4a393f0a8def7ac46907e1fb0782cd3538a","verifying_contract":"intents.near","deadline":"2025-07-30T12:57:16.264Z","nonce":"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=","intents":[]}',
			signature:
				"secp256k1:CvkU692XuyALYxSDvrpFviJozq5DPrwADzqqV6DA1DDAPy93PaBvWPEngZzREqJetbLpBEmYSV7Joo61yXKXAoJ3i",
		};

		const hash = await computeIntentHash(multiPayload);
		expect(hash).toEqual("7YaoCk1j9rSrM7kw3ip33ySyJLtqWVxFRQHW5PeWMKAf");
	});
});

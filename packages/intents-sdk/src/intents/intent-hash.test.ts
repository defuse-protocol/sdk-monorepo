import { describe, expect, it } from "vitest";
import { utils } from "@defuse-protocol/internal-utils";
import { providers } from "near-api-js";
import * as v from "valibot";
import type { MultiPayload } from "./shared-types";
import { computeMultiPayloadHash } from "./intent-hash";

describe("computeMultiPayloadHash()", () => {
	it("computes hash for ERC-191 standard with non ASCII character (é in café)", async () => {
		const multiPayload: MultiPayload = {
			standard: "erc191",
			payload:
				'{"signer_id":"0x5a95b4a393f0a8def7ac46907e1fb0782cd3538a","verifying_contract":"intents.near","deadline":"2025-07-30T12:57:16.264Z","nonce":"ZSqiEM8mCXluSxIrG03jw6th7vMfKNLRmYKaAkKb1xk=","intents":[{"amount":"100000000","intent":"ft_withdraw","memo":"café","receiver_id":"btc.omft.near","token":"btc.omft.near"}]}',
			signature:
				"secp256k1:CvkU692XuyALYxSDvrpFviJozq5DPrwADzqqV6DA1DDAPy93PaBvWPEngZzREqJetbLpBEmYSV7Joo61yXKXAoJ3i",
		};

		const hash = await computeMultiPayloadHash(multiPayload);
		expect(hash).toEqual("APvv5zuHPLuSG4xwe24FiyCdiWVXVbkyfkXBBjGy5xJL");
	});

	it.each([
		{
			standard: "nep413",
			payload: {
				message:
					'{"deadline":"2035-11-03T15:05:57.549Z","intents":[],"signer_id":"226a0eceead177138b56937a05f8bdb19b4091a5cdc4419bdea07b3ea0bd9195"}',
				nonce: "lsLpUoT0zvHcy1vPAEhdcY7jkUVJv1jYtdfFWkFGyvs=",
				recipient: "intents.near",
			},
			public_key: "ed25519:3KLfGdhUSYpdYtLvjRXDryT6Za5wEQHvhiJcBN398yjS",
			signature:
				"ed25519:5ZwThUnnHDHqqMYE4A5A7jtAkGAyKYe63ZDmvvBysLkRt6YjyQwG1uyhc39VHZYxcmF9S3jsiAMSS9LWzB3FT8NZ",
		},
		{
			standard: "erc191",
			payload:
				'{\n  "signer_id": "0xdead698d1ff2efca2c4c1f171d6a92dd3b3e5e73",\n  "verifying_contract": "intents.near",\n  "deadline": "2035-11-03T14:56:10.273Z",\n  "nonce": "nwI7zQ3y64bUuyVKCy0Ar6mWyWJ4saYTC6JIrmE5tl8=",\n  "intents": []\n}',
			signature:
				"secp256k1:C7BJg2rrPFWG17ZRQ4jFssKvDxwym3Erin5xoW3FncAUKtcHudESrRtfpBXjtS9eCRp4dE6TrQfpVJJKQK2LSbxZ5",
		},
		{
			standard: "tip191",
			payload:
				'{\n  "signer_id": "0xdead698d1ff2efca2c4c1f171d6a92dd3b3e5e73",\n  "verifying_contract": "intents.near",\n  "deadline": "2035-11-03T14:54:28.067Z",\n  "nonce": "w3dMuJp6v9PyJYyYSvMw+EcHqhHTrbtZWqdXb88k/IU=",\n  "intents": [],\n  "message_size_validation": "Validates message size compatibility with wallet signing requirements."\n}',
			signature:
				"secp256k1:HDmTWTMrbckFD49vCTAF4XKPatECCuVXDqF1fN9TZoTYG6nEy1CoZXQ13nQMEwbe8j35Qikfym4tUKKgjnspkZtfh",
		},
		{
			standard: "raw_ed25519",
			payload:
				'{"signer_id":"74affa71ab030d400fdfa1bed033dfa6fd3ae34f92d17c046ebe368e80d53751","verifying_contract":"intents.near","deadline":"2035-11-03T14:49:44.589Z","nonce":"1TwpgYHWXK29O6zby1R6QPJOY/Nb/S9Bb+dJ8m+Dd2Q=","intents":[]}',
			public_key: "ed25519:8rVvtHWFr8hasdQGGD5WiQBTyr4iH2ruEPPVfj491RPN",
			signature:
				"ed25519:4N9DSi9Vh6w9Jq1ybkiS2g9fb1P1jM2Uh35huT3qc6PM8yeCQYE1gPTCN9iDQA6vh9NFrqCP1xWpHJET9U7AnJ7x",
		},
		{
			standard: "webauthn",
			payload:
				'{"signer_id":"0x5684ac3f39e9c2e7cf649cbc52477e0268623406","verifying_contract":"intents.near","deadline":"2035-11-03T15:10:02.899Z","nonce":"c80oewARgyvnE+vOYfQSaDJ2BIVJ1Y67V2SS0w2acg8=","intents":[]}',
			public_key:
				"p256:4Z12zTVt4NeconjicRusKRN4quwB3hysGWQmXLJTNFCtHCCruAXpFK9rdXPTw1HeNWQTKCFZhn2serBqqzk3KfHd",
			signature:
				"p256:4o7xxP2aY2kgK9YdDL9KE6QiMwCdmG8HLoBCaT4gNkS7W8SzunniYfEknZL9bLPz7pVUGmaMu5VdjNaCZ2Ht2UkT",
			client_data_json:
				'{"type":"webauthn.get","challenge":"-ikLNwQabhBKULqw2pDaWlvsHveUA96SEYCCc5oE7Tc","origin":"http://localhost:3000","crossOrigin":false}',
			authenticator_data: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA",
		},
		{
			standard: "ton_connect",
			address:
				"0:fa63f5195b0f8682d3f3413e2b40decfae7778b3691748a2d55dae5b243a3054",
			domain: "tonconnect-demo-dapp-with-wallet.vercel.app",
			timestamp: 1762354640,
			payload: {
				network: "-239",
				from: "0:fa63f5195b0f8682d3f3413e2b40decfae7778b3691748a2d55dae5b243a3054",
				type: "text",
				text: '{\n  "signer_id": "d1e7c122f8a43c7d7433548c4604edd4dffcfe5bb1d036499684980c115500bf",\n  "verifying_contract": "intents.near",\n  "deadline": "2035-11-03T14:57:16.445Z",\n  "nonce": "s7ne425+Pw+eVR7j02peS/wIxHKu64znkTJYeCTAfPk=",\n  "intents": []\n}',
			},
			public_key: "ed25519:F8PB56zdMYNDL7Mq43DV4cV17uRqQkpn6ZygNdqavXCr",
			signature:
				"ed25519:i5REHik6CRvvfnKsUtSDvxPeeLiPQsNMGpg9yARs9vtnZxSV9mht9K1tW2LZp8pGd4C83YZRXNG3Y5dBFdLMENd",
		},
		{
			standard: "sep53",
			payload:
				'{\n  "signer_id": "1b1a88aa85913ee8ba7ffb093c7a77396c046be58414426ace3da33b19bc9846",\n  "verifying_contract": "intents.near",\n  "deadline": "2035-11-03T14:51:56.335Z",\n  "nonce": "331irxwHR+m4uNo8yVT2V5tG69OIYbshjbas8er0zvU=",\n  "intents": []\n}',
			public_key: "ed25519:2poUXG8SwrwaSEmiEnqzLaVYQNJjvsMPkeq5h6zFz97b",
			signature:
				"ed25519:2X7p3ZM6QGr2Pt5qpSuMSJKMwpZfzQQf7NVyZ8jduNpCkMrF6GhjP15x7xtVd9K372FTQNqzrodBtKFkjDA1jPWt",
		},
	] satisfies MultiPayload[])(
		"computes hash (case %#)",
		async (multiPayload) => {
			const hash = await computeMultiPayloadHash(multiPayload);
			const expected = await sim(multiPayload);
			expect(hash).toEqual(expected);
		},
	);
});

async function sim(signedIntent: MultiPayload) {
	const rpc = new providers.JsonRpcProvider({
		url: "https://relmn.aurora.dev",
	});

	const result = await utils.queryContract({
		nearClient: rpc,
		contractId: "intents.near",
		methodName: "simulate_intents",
		args: { signed: [signedIntent] },
		finality: "optimistic",
		schema: v.object({
			intents_executed: v.array(
				v.object({
					account_id: v.string(),
					intent_hash: v.string(),
					nonce: v.string(),
				}),
			),
			logs: v.array(v.string()),
		}),
	});

	return result.intents_executed[0]!.intent_hash;
}

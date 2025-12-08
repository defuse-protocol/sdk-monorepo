// biome-ignore-all lint/style/noRestrictedGlobals: Buffer OK in tests
import { describe, expect, it } from "vitest";
import { authHandleToIntentsUserId } from "./authIdentity";
import {
	makeEmptyMessage, // Add this import
	makeInnerSwapMessage,
	makeSwapMessage,
} from "./messageFactory";

describe("makeSwapMessage()", () => {
	const innerMessage = makeInnerSwapMessage({
		tokenDeltas: [["foo.near", 100n]],
		signerId: authHandleToIntentsUserId("user.near", "near"),
		deadlineTimestamp: 1704110400000, // 2024-01-01T12:00:00.000Z
		appFee: [],
		appFeeRecipient: "",
	});

	it("should return a WalletMessage object", () => {
		const message = makeSwapMessage({
			innerMessage,
			nonce: new Uint8Array(32),
		});

		expect(message).toEqual({
			NEP413: {
				message: `{"deadline":"2024-01-01T12:00:00.000Z","intents":[{"intent":"token_diff","diff":{"foo.near":"100"}}],"signer_id":"user.near"}`,
				recipient: "intents.near",
				nonce: new Uint8Array(32),
			},
			ERC191: {
				message: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": "2024-01-01T12:00:00.000Z",
  "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "intents": [
    {
      "intent": "token_diff",
      "diff": {
        "foo.near": "100"
      }
    }
  ]
}`,
			},
			SOLANA: {
				message: Uint8Array.from(
					Buffer.from(
						JSON.stringify({
							signer_id: "user.near",
							verifying_contract: "intents.near",
							deadline: "2024-01-01T12:00:00.000Z",
							nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
							intents: [{ intent: "token_diff", diff: { "foo.near": "100" } }],
						}),
						"utf-8",
					),
				),
			},
			STELLAR: {
				message: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": "2024-01-01T12:00:00.000Z",
  "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "intents": [
    {
      "intent": "token_diff",
      "diff": {
        "foo.near": "100"
      }
    }
  ]
}`,
			},
			WEBAUTHN: expect.any(Object),
			TON_CONNECT: {
				message: {
					type: "text",
					text: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": "2024-01-01T12:00:00.000Z",
  "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "intents": [
    {
      "intent": "token_diff",
      "diff": {
        "foo.near": "100"
      }
    }
  ]
}`,
				},
			},
			TRON: {
				message: `{
  "signer_id": "user.near",
  "verifying_contract": "intents.near",
  "deadline": "2024-01-01T12:00:00.000Z",
  "nonce": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  "intents": [
    {
      "intent": "token_diff",
      "diff": {
        "foo.near": "100"
      }
    }
  ]
}`,
			},
		});
	});

	describe("WEBAUTHN format", () => {
		const config = {
			innerMessage: makeInnerSwapMessage({
				tokenDeltas: [["foo.near", 100n]],
				signerId: authHandleToIntentsUserId("user.near", "near"),
				deadlineTimestamp: 1704110400000, // 2024-01-01T12:00:00.000Z,
				appFee: [],
				appFeeRecipient: "",
			}),
			recipient: "recipient.near",
			nonce: new Uint8Array(32),
		};

		it("should return WEBAUTHN object", () => {
			const message = makeSwapMessage(config);

			expect(message.WEBAUTHN.payload).toMatchInlineSnapshot(
				`"{"signer_id":"user.near","verifying_contract":"intents.near","deadline":"2024-01-01T12:00:00.000Z","nonce":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=","intents":[{"intent":"token_diff","diff":{"foo.near":"100"}}]}"`,
			);
			expect(message.WEBAUTHN.challenge).toHaveLength(32); // SHA-256 is 32 bytes
		});

		it("should compute challenge using SHA-256", async () => {
			const message = makeSwapMessage(config);

			const webauthnPayload = message.WEBAUTHN.payload;
			const webauthnChallenge = message.WEBAUTHN.challenge;

			expect(webauthnChallenge).toEqual(
				new Uint8Array(
					await crypto.subtle.digest(
						"SHA-256",
						Buffer.from(webauthnPayload, "utf-8"),
					),
				),
			);
		});

		it("should generate deterministic challenge for same inputs", () => {
			const message1 = makeSwapMessage(structuredClone(config));
			const message2 = makeSwapMessage(structuredClone(config));

			expect(message1.WEBAUTHN.challenge).toEqual(message2.WEBAUTHN.challenge);
		});

		it("should change challenge when any input field changes", () => {
			const baseMessage = makeSwapMessage(config);

			const differentDeltasMsg = makeSwapMessage({
				...config,
				nonce: crypto.getRandomValues(new Uint8Array(32)),
			});

			expect(differentDeltasMsg.WEBAUTHN.challenge).not.toEqual(
				baseMessage.WEBAUTHN.challenge,
			);
		});
	});

	it("should return a WalletMessage with random nonce", () => {
		const msg1 = makeSwapMessage({ innerMessage });
		const msg2 = makeSwapMessage({ innerMessage });
		expect(msg1.NEP413.nonce).not.toEqual(msg2.NEP413.nonce);
	});

	it("should include referral in token_diff intent", () => {
		const innerMessage = makeInnerSwapMessage({
			tokenDeltas: [
				["foo.near", -100n],
				["bar.near", 200n],
			],
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: 1704110400000,
			referral: "referrer.near",
			appFee: [],
			appFeeRecipient: "",
		});

		expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "200",
              "foo.near": "-100",
            },
            "intent": "token_diff",
            "memo": undefined,
            "referral": "referrer.near",
          },
        ],
        "signer_id": "user.near",
      }
    `);
	});

	it("should merge amounts in/out with same token", () => {
		const innerMessage = makeInnerSwapMessage({
			tokenDeltas: [
				["foo.near", -150n],
				["bar.near", -200n],
				["bar.near", 270n],
				["foo.near", 100n],
			],
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: 1704110400000,
			appFee: [],
			appFeeRecipient: "",
		});

		expect(innerMessage).toMatchInlineSnapshot(`
      {
        "deadline": "2024-01-01T12:00:00.000Z",
        "intents": [
          {
            "diff": {
              "bar.near": "70",
              "foo.near": "-50",
            },
            "intent": "token_diff",
            "memo": undefined,
            "referral": undefined,
          },
        ],
        "signer_id": "user.near",
      }
    `);
	});

	it("includes app fee transfer", () => {
		const innerMessage = makeInnerSwapMessage({
			tokenDeltas: [
				["foo.near", -100n],
				["bar.near", 200n],
			],
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: 1704110400000,
			appFee: [["baz.near", 30n]],
			appFeeRecipient: "app_fee_mock.near",
		});

		expect(innerMessage).toMatchInlineSnapshot(`
			{
			  "deadline": "2024-01-01T12:00:00.000Z",
			  "intents": [
			    {
			      "diff": {
			        "bar.near": "200",
			        "foo.near": "-100",
			      },
			      "intent": "token_diff",
			      "memo": undefined,
			      "referral": undefined,
			    },
			    {
			      "intent": "transfer",
			      "memo": "APP_FEE",
			      "receiver_id": "app_fee_mock.near",
			      "tokens": {
			        "baz.near": "30",
			      },
			    },
			  ],
			  "signer_id": "user.near",
			}
		`);
	});
});

describe("makeEmptyMessage()", () => {
	const TEST_TIMESTAMP = 1704110400000; // 2024-01-01T12:00:00.000Z
	const TEST_NONCE = new Uint8Array(32);

	it("should create message with empty intents array", () => {
		const message = makeEmptyMessage({
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: TEST_TIMESTAMP,
			nonce: TEST_NONCE,
		});

		expect(message.NEP413).toEqual({
			message: `{"deadline":"2024-01-01T12:00:00.000Z","intents":[],"signer_id":"user.near"}`,
			recipient: "intents.near",
			nonce: TEST_NONCE,
		});
	});

	it("should use default nonce when not provided", () => {
		const message = makeEmptyMessage({
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: TEST_TIMESTAMP,
		});

		expect(message.NEP413.nonce).toHaveLength(32);
		const parsed = JSON.parse(message.NEP413.message);
		expect(parsed.intents).toEqual([]);
	});
});

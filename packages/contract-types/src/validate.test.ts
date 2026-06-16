import { describe, expect, it } from "vitest";
import {
	MultiPayloadValidator,
	MultiPayloadNarrowedValidator,
} from "./validate.js";

const validDefusePayload = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	nonce: "abc123",
	signer_id: "bob.near",
	verifying_contract: "defuse.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

// NEP413 message has a narrower format - without nonce/verifying_contract
// because those are part of the outer Nep413Payload wrapper
const validNep413Message = JSON.stringify({
	deadline: "2025-12-31T23:59:59Z",
	signer_id: "bob.near",
	intents: [{ intent: "transfer", receiver_id: "alice.near", tokens: {} }],
});

describe("MultiPayloadNarrowedValidator", () => {
	it("parses and validates erc191 variant", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value).toEqual({
			standard: "erc191",
			payload: {
				original: validDefusePayload,
				parsed: JSON.parse(validDefusePayload),
			},
		});
	});

	it("parses and validates nep413 variant", () => {
		const input = {
			standard: "nep413",
			payload: {
				message: validNep413Message,
				nonce: "dGVzdG5vbmNl",
				recipient: "defuse.near",
			},
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		const payload = result.value.payload as { message: unknown };
		expect(payload.message).toEqual({
			original: validNep413Message,
			parsed: JSON.parse(validNep413Message),
		});
	});

	it("parses and validates ton_connect text variant", () => {
		const input = {
			standard: "ton_connect",
			payload: {
				type: "text",
				text: validDefusePayload,
			},
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		const payload = result.value.payload as { text: unknown };
		expect(payload.text).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("parses and validates tip191 variant", () => {
		const input = {
			standard: "tip191",
			payload: validDefusePayload,
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value).toEqual({
			standard: "tip191",
			payload: {
				original: validDefusePayload,
				parsed: JSON.parse(validDefusePayload),
			},
		});
	});

	it("parses and validates sep53 variant", () => {
		const input = {
			standard: "sep53",
			payload: validDefusePayload,
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value).toEqual({
			standard: "sep53",
			payload: {
				original: validDefusePayload,
				parsed: JSON.parse(validDefusePayload),
			},
		});
	});

	it("does not modify original input", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
		};

		MultiPayloadNarrowedValidator.validate(input);
		expect(input.payload).toBe(validDefusePayload);
	});

	it("rejects extra properties", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
			signature: "should not be here",
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
		expect(result.issues?.length).toBeGreaterThan(0);
	});

	it("rejects invalid payload", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("returns issue for non-serializable input", () => {
		const input = {
			standard: "erc191",
			payload: BigInt(123),
		};

		const result = MultiPayloadNarrowedValidator.validate(input);
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toContain("BigInt");
	});

	it("exposes schema", () => {
		expect(MultiPayloadNarrowedValidator.schema).toBeDefined();
		expect(typeof MultiPayloadNarrowedValidator.schema).toBe("object");
	});

	it("implements Standard Schema interface", () => {
		expect(MultiPayloadNarrowedValidator["~standard"].version).toBe(1);
		expect(MultiPayloadNarrowedValidator["~standard"].vendor).toBe("ajv");
		expect(typeof MultiPayloadNarrowedValidator["~standard"].validate).toBe(
			"function",
		);
	});
});

describe("MultiPayloadValidator", () => {
	it("parses and validates JSON payload for erc191", () => {
		const input = {
			standard: "erc191",
			payload: validDefusePayload,
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value.payload).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("parses and validates JSON payload for tip191", () => {
		const input = {
			standard: "tip191",
			payload: validDefusePayload,
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value.payload).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("parses and validates JSON payload for sep53", () => {
		const input = {
			standard: "sep53",
			payload: validDefusePayload,
			public_key: "ed25519:key123",
			signature: "ed25519:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("Expected success");
		expect(result.value.payload).toEqual({
			original: validDefusePayload,
			parsed: JSON.parse(validDefusePayload),
		});
	});

	it("rejects tip191 with wrong signature prefix", () => {
		const input = {
			standard: "tip191",
			payload: validDefusePayload,
			signature: "ed25519:wrong_prefix",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("rejects sep53 with wrong key prefix", () => {
		const input = {
			standard: "sep53",
			payload: validDefusePayload,
			public_key: "secp256k1:wrong_prefix",
			signature: "ed25519:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("rejects invalid JSON payload", () => {
		const input = {
			standard: "erc191",
			payload: "not valid json",
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("rejects invalid DefusePayload structure", () => {
		const input = {
			standard: "erc191",
			payload: JSON.stringify({ invalid: "structure" }),
			signature: "secp256k1:sig123",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("validates webauthn with p256 key algorithm", () => {
		const input = {
			standard: "webauthn",
			payload: validDefusePayload,
			public_key: "p256:base58encodedkey",
			signature: "p256:base58encodedsig",
			authenticator_data: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAA",
			client_data_json:
				'{"type":"webauthn.get","challenge":"...","origin":"https://app.example.com"}',
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates webauthn with ed25519 key algorithm", () => {
		const input = {
			standard: "webauthn",
			payload: validDefusePayload,
			public_key: "ed25519:base58encodedkey",
			signature: "ed25519:base58encodedsig",
			authenticator_data: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAA",
			client_data_json:
				'{"type":"webauthn.get","challenge":"...","origin":"https://app.example.com"}',
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("rejects webauthn with mixed key algorithms", () => {
		const input = {
			standard: "webauthn",
			payload: validDefusePayload,
			public_key: "ed25519:base58encodedkey",
			signature: "p256:base58encodedsig",
			authenticator_data: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MFAAAAAA",
			client_data_json:
				'{"type":"webauthn.get","challenge":"...","origin":"https://app.example.com"}',
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeDefined();
	});

	it("validates erc191 (evm) example", () => {
		const input = {
			standard: "erc191",
			payload:
				'{"signer_id":"0xdead698d1ff2efca2c4c1f171d6a92dd3b3e5e73","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:15:51.045Z","nonce":"P9gqsCQ/q6LSS8wspzuFCn3kIgrkNwtTI1HbAUNFLiI=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			signature:
				"secp256k1:9t2FHV4xj3aswbfbRrhn9BBZiWbRAgoVDXCgrkEqeVqXhNQvP2FzzR1A2yJt59ajJ8ACsKTDsSYAFfe4kLHUW9BEw",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates nep413 (near) example", () => {
		const input = {
			standard: "nep413",
			payload: {
				message:
					'{"deadline":"2036-04-07T11:14:46.933Z","intents":[],"signer_id":"226a0eceead177138b56937a05f8bdb19b4091a5cdc4419bdea07b3ea0bd9195","external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
				nonce: "irwGIo4t0zkK68X8BD+3KmiZuWl6CQlyU0uHmYPh+UI=",
				recipient: "staging-intents.near",
			},
			public_key: "ed25519:3KLfGdhUSYpdYtLvjRXDryT6Za5wEQHvhiJcBN398yjS",
			signature:
				"ed25519:4i9oAekwJP2JU1eCHF133CVyiAyysJXvFNGjcgaKvPv5Sd8ELPf3NicKny9wXRAupLQ9Us4ZZk2umjJLJjepzVYK",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates raw_ed25519 (solana) example", () => {
		const input = {
			standard: "raw_ed25519",
			payload:
				'{"signer_id":"74affa71ab030d400fdfa1bed033dfa6fd3ae34f92d17c046ebe368e80d53751","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:17:06.150Z","nonce":"ezvB2ugJWfBZyPKpmmX09xDoE2BUtaxTOzSRd+/nerc=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			public_key: "ed25519:8rVvtHWFr8hasdQGGD5WiQBTyr4iH2ruEPPVfj491RPN",
			signature:
				"ed25519:5MC3HpRE1pVrhVfpKtr8BhXdx2eQookKovrdUojdmyDaKBamVNe6fNkE9GpVSzKAhv1XWqScRjXZqKetnJhv56WR",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates sep53 (stellar) example", () => {
		const input = {
			standard: "sep53",
			payload:
				'{"signer_id":"1b1a88aa85913ee8ba7ffb093c7a77396c046be58414426ace3da33b19bc9846","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:18:19.159Z","nonce":"vMMrkvhiUj6Drid9Kvy1fjs9P0VAsZS1aPkIi1qUdY0=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			public_key: "ed25519:2poUXG8SwrwaSEmiEnqzLaVYQNJjvsMPkeq5h6zFz97b",
			signature:
				"ed25519:4nxNWdzZAyTTXurhJRC8mt74qFJrm89XBWHxWYZaf1tAHSNyNxDa9wqcUSSex1kggyKeuJTmTkCnRTgM3KEuJAvy",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates tip191 (tron) example", () => {
		const input = {
			standard: "tip191",
			payload:
				'{"signer_id":"0xdead698d1ff2efca2c4c1f171d6a92dd3b3e5e73","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:25:58.156Z","nonce":"vovo6dvxT0r2e8pKtLZAFhLGkW22BVp/Hqum2BbSrf4=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			signature:
				"secp256k1:DQqv4MeiQopDrm44Kc1CfGbkMUJomUeQ39DaJpvzjUwsv891CeShTgzp8xcu7gTXbyVa9yytyUjXgMWzmMa1R1WYg",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates ton_connect (ton) example with network and from fields", () => {
		const input = {
			standard: "ton_connect",
			address:
				"0:fa63f5195b0f8682d3f3413e2b40decfae7778b3691748a2d55dae5b243a3054",
			domain: "near-intents.org",
			timestamp: 1775820283,
			payload: {
				network: "-239",
				from: "0:fa63f5195b0f8682d3f3413e2b40decfae7778b3691748a2d55dae5b243a3054",
				type: "text",
				text: '{"signer_id":"d1e7c122f8a43c7d7433548c4604edd4dffcfe5bb1d036499684980c115500bf","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:24:41.155Z","nonce":"3K/IQh8XCimsIBOkJUqIAzzRRKYq3pLWY7gqvoNM7do=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			},
			public_key: "ed25519:F8PB56zdMYNDL7Mq43DV4cV17uRqQkpn6ZygNdqavXCr",
			signature:
				"ed25519:2qWoawCWgNN8eyzaH5JHHrKrKj5XYAmxSuAhVnKkPV4LeZLSPxymT4d68nVekY7JUyxnjLaEvcydpixKc9mM4ZbU",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});

	it("validates webauthn (passkey) example", () => {
		const input = {
			standard: "webauthn",
			payload:
				'{"signer_id":"0x3afc25bff7090e656498acb12cd600920734b939","verifying_contract":"staging-intents.near","deadline":"2036-04-07T11:20:21.466Z","nonce":"pjyq79eW1iuc6NkNRNHN792l2ud8QxJeUMNoaC/wmTs=","intents":[],"external_app_data":{"configs":[{"type":"auth","expires_in":604800}]}}',
			public_key:
				"p256:3C8NVQouSmW5PqLEQJiJuM14fQ5S7iHEoAhLidYHB5PEMJxKXfgP1RUbSqPiVikhxAPac3iLQSpTSKAgBd1LmvUX",
			signature:
				"p256:2VThe5XktBtfbniAo1CuFjYjqEPwYooRSezjZLmgWRhhKZGVd5gBGw8mmzaSZizx24ZfoysQNXWK2yeah9Vi6dZD",
			client_data_json:
				'{"type":"webauthn.get","challenge":"GD_V4dCWbZsUwPHX4JhKErzWVXoUpvrvwRCjPqYEm9k","origin":"http://localhost:3000","crossOrigin":false}',
			authenticator_data: "SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA",
		};

		const result = MultiPayloadValidator.validate(input);
		expect(result.issues).toBeUndefined();
	});
});

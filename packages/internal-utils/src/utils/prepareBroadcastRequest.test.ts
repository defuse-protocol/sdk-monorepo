import { describe, expect, it } from "vitest";
import type {
	ERC191SignatureData,
	NEP413SignatureData,
	SolanaSignatureData,
	StellarSignatureData,
	TonConnectSignatureData,
	WalletMessage,
	WebAuthnSignatureData,
} from "../types/walletMessage";
import { authHandleToIntentsUserId } from "./authIdentity";
import { makeInnerSwapMessage, makeSwapMessage } from "./messageFactory";
import { prepareSwapSignedData } from "./prepareBroadcastRequest";

describe("prepareSwapSignedData()", () => {
	const swapMessage = makeSwapMessage({
		innerMessage: makeInnerSwapMessage({
			tokenDeltas: [["foo.near", 100n]],
			signerId: authHandleToIntentsUserId("user.near", "near"),
			deadlineTimestamp: 1704110400000,
			appFee: [],
			appFeeRecipient: "",
		}),
		nonce: new Uint8Array(32),
	});

	const walletMessage: WalletMessage = {
		NEP413: {
			message: `{"foo":"bar"}`,
			recipient: "defuse.near",
			nonce: Buffer.from(
				"esXbbxyJNApGznX1v8kT5ojuat7jqUv84Ib+Q6hWdzI=",
				"base64",
			),
		},
		ERC191: {
			message: JSON.stringify({ foo: "bar" }),
		},
		SOLANA: {
			message: Uint8Array.from(
				Buffer.from(JSON.stringify({ foo: "bar" }), "utf8"),
			),
		},
		STELLAR: {
			message: JSON.stringify({ foo: "bar" }),
		},
		WEBAUTHN: swapMessage.WEBAUTHN,
		TON_CONNECT: swapMessage.TON_CONNECT,
		TRON: {
			message: JSON.stringify({ foo: "bar" }),
		},
	};

	it("should return the correct signed data for a NEP141 signature", () => {
		const signature: NEP413SignatureData = {
			type: "NEP413",
			signatureData: {
				accountId: "user.near",
				publicKey: "ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga",
				signature: "stH6JnShG+GwWCsfN9iu/m4un6qwYLN9Df+5oQYsL7Q=",
			},
			signedData: walletMessage.NEP413,
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress: "user.near",
				userChainType: "near",
			}),
		).toMatchSnapshot();
	});

	it("should return the correct signed data for an ERC191 signature", () => {
		const signature: ERC191SignatureData = {
			type: "ERC191",
			signatureData: "0xdeadbeef1c",
			signedData: walletMessage.ERC191,
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress: "0xabcd",
				userChainType: "evm",
			}),
		).toMatchSnapshot();
	});

	it("should return the correct signed data for a Solana signature", () => {
		const signature: SolanaSignatureData = {
			type: "SOLANA",
			signatureData: Buffer.from("deadbeef1c", "hex"),
			signedData: walletMessage.SOLANA,
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress: "DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy",
				userChainType: "solana",
			}),
		).toMatchSnapshot();
	});

	it("should return the correct signed data for a Stellar SEP-0053 signature", () => {
		const signature: StellarSignatureData = {
			type: "STELLAR_SEP53",
			signatureData: Buffer.from("deadbeef1c", "hex"),
			signedData: {
				message: JSON.stringify({ foo: "bar" }),
			},
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress: "GDZ7T36V5BBWLZTM7NGZYWJYRIYBFXFVYQT3EOGO7G4JCEO6DBYL7DC2",
				userChainType: "stellar",
			}),
		).toMatchSnapshot();
	});

	it.skip("should return the correct signed data for a WebAuthn signature", async () => {
		const signature: WebAuthnSignatureData = {
			type: "WEBAUTHN",
			signatureData: {
				authenticatorData: Buffer.from("dead", "hex").buffer,
				clientDataJSON: Buffer.from('{"some": "json"}', "utf-8").buffer,
				signature: Buffer.from("beef", "hex").buffer,
				userHandle: Buffer.from("1ee7", "hex").buffer,
			},
			signedData: walletMessage.WEBAUTHN,
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress: "ed25519:Gxa24TGbJu4mqdhW3GbvLXmf4bSEyxVicrtpChDWbgga",
				userChainType: "webauthn",
			}),
		).toMatchSnapshot();
	});

	it("should return the correct signed data for a TonConnect signature", () => {
		const signature: TonConnectSignatureData = {
			type: "TON_CONNECT",
			signatureData: {
				signature:
					"4o7K0k+5pQUHVTX3fD03JIwcixdxmPE7pGgVmQsUHxdZ+G2OJEeXKDv5cnrgPPbZQDgUrMGWfXhYvRFpdJxuAg==",
				address:
					"0:fa63f5195b0f8682d3f3413e2b40decfae7778b3691748a2d55dae5b243a3054",
				timestamp: 1748949269,
				domain: "ton-connect.github.io",
				payload: walletMessage.TON_CONNECT.message,
			},
			signedData: walletMessage.TON_CONNECT,
		};

		expect(
			prepareSwapSignedData(signature, {
				userAddress:
					"d1e7c122f8a43c7d7433548c4604edd4dffcfe5bb1d036499684980c115500bf",
				userChainType: "ton",
			}),
		).toMatchSnapshot();
	});
});

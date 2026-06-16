import { describe, expect, it } from "vitest";
import type { MultiPayload } from "@defuse-protocol/contract-types";
import { computeTonConnectHash } from "./ton-connect";

describe("computeTonConnectHash", () => {
	it("produces identical hash whether the address is raw or user-friendly", () => {
		const USER_FRIENDLY = "UQBkxBWE4Gf9gd2sNbm1SJ6zXWnbA6ywoBvpAUQhBXJY_YiM";
		const RAW =
			"0:64c41584e067fd81ddac35b9b5489eb35d69db03acb0a01be9014421057258fd";
		const payloadWithUserFriendlyAddress = {
			standard: "ton_connect",
			address: USER_FRIENDLY,
			domain: "near.com",
			timestamp: 1778685374,
			payload: { type: "text", text: "hello world" },
			public_key: "ed25519:99q8mY2bNRik43niUSKrXWsHGgmp9S6iG6VKmyta2Znj",
			signature: "ed25519:not-checked-by-hash-fn",
		} satisfies Extract<MultiPayload, { standard: "ton_connect" }>;

		const payloadWithRawAddress = {
			...payloadWithUserFriendlyAddress,
			address: RAW,
		} satisfies Extract<MultiPayload, { standard: "ton_connect" }>;

		expect(computeTonConnectHash(payloadWithUserFriendlyAddress)).toEqual(
			computeTonConnectHash(payloadWithRawAddress),
		);
	});
});

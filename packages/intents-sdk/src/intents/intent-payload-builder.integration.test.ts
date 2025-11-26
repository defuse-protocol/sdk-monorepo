import { describe, it, expect } from "vitest";
import { IntentsSDK } from "../sdk";
import type { IntentPrimitive } from "./shared-types";
import { IntentPayloadBuilder } from "./intent-payload-builder";

describe("IntentPayloadBuilder integration", () => {
	it("is accessible from SDK instance", () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const builder = sdk.intentBuilder();
		expect(builder).toBeInstanceOf(IntentPayloadBuilder);
	});

	it("builds complete intent payload", async () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const intent: IntentPrimitive = {
			intent: "ft_withdraw",
			token: "usdc.omft.near",
			amount: "1000000",
			receiver_id: "user.near",
		};

		const payload = await sdk
			.intentBuilder()
			.setSigner("0x1234567890abcdef")
			.addIntent(intent)
			.build();

		expect(payload).toEqual({
			verifying_contract: "intents.near",
			signer_id: "0x1234567890abcdef",
			intents: [intent],
			nonce: expect.any(String),
			deadline: expect.any(String),
		});
	});

	it("works with stage environment", async () => {
		const sdk = new IntentsSDK({
			env: "stage",
			referral: "test-app",
		});

		const payload = await sdk.intentBuilder().setSigner("test.near").build();
		expect(payload).toHaveProperty(
			"verifying_contract",
			"staging-intents.near",
		);
	});

	it("supports multiple intents", async () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const intents: IntentPrimitive[] = [
			{
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user1.near",
			},
			{
				intent: "ft_withdraw",
				token: "btc.omft.near",
				amount: "500000",
				receiver_id: "user2.near",
			},
		];

		const payload = await sdk
			.intentBuilder()
			.setSigner("0x1234567890abcdef")
			.addIntents(intents)
			.build();

		expect(payload.intents).toHaveLength(2);
		expect(payload.intents).toEqual(intents);
	});

	it("allows creating multiple independent builders", async () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const builder1 = sdk.intentBuilder().setSigner("0x1111");
		const builder2 = sdk.intentBuilder().setSigner("0x2222");

		const [payload1, payload2] = await Promise.all([
			builder1.build(),
			builder2.build(),
		]);

		expect(payload1.signer_id).toBe("0x1111");
		expect(payload2.signer_id).toBe("0x2222");
	});

	it("supports custom deadlines", async () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const customDeadline = new Date("2026-12-31T23:59:59Z");

		const payload = await sdk
			.intentBuilder()
			.setSigner("0x1234")
			.setDeadline(customDeadline)
			.build();

		expect(payload.deadline).toBe(customDeadline.toISOString());
	});

	it("uses default deadline if not specified", async () => {
		const sdk = new IntentsSDK({
			env: "production",
			referral: "test-app",
		});

		const beforeBuild = Date.now();
		const payload = await sdk.intentBuilder().setSigner("0x1234").build();
		const afterBuild = Date.now();

		const deadlineTime = new Date(payload.deadline).getTime();
		// Default is 1 minute from build time
		expect(deadlineTime).toBeGreaterThanOrEqual(beforeBuild + 60000);
		expect(deadlineTime).toBeLessThanOrEqual(afterBuild + 60000 + 2000); // +2s tolerance
	});
});

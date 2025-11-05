import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntentPayloadBuilder } from "./intent-payload-builder";
import type { ISaltManager } from "./interfaces/salt-manager";
import type { NearIntentsEnv } from "@defuse-protocol/internal-utils";
import type { IntentPrimitive } from "./shared-types";
import { VersionedNonceBuilder } from "./expirable-nonce";

describe("IntentPayloadBuilder", () => {
	let mockSaltManager: ISaltManager;
	let builder: IntentPayloadBuilder;
	const testSalt = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
	const testEnv: NearIntentsEnv = "production";

	beforeEach(() => {
		mockSaltManager = {
			getCachedSalt: vi.fn().mockResolvedValue(testSalt),
			refresh: vi.fn().mockResolvedValue(testSalt),
		};

		builder = new IntentPayloadBuilder({
			env: testEnv,
			saltManager: mockSaltManager,
		});
	});

	describe("basic builder operations", () => {
		it("creates a builder with correct environment", () => {
			const state = builder.getState();
			expect(state.env).toBe("production");
			expect(state.verifyingContract).toBe("intents.near");
		});

		it("sets signer correctly", () => {
			const signerId = "0x1234567890abcdef";
			builder.setSigner(signerId);

			const state = builder.getState();
			expect(state.signerId).toBe(signerId);
		});

		it("validates signer_id is a valid NEAR account", () => {
			// Valid NEAR accounts
			expect(() => builder.setSigner("user.near")).not.toThrow();
			expect(() => builder.setSigner("sub.user.near")).not.toThrow();
			expect(() => builder.setSigner("alice-bob.near")).not.toThrow();
			expect(() => builder.setSigner("account_123.near")).not.toThrow();

			// Implicit accounts (64 hex chars)
			expect(() =>
				builder.setSigner(
					"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				),
			).not.toThrow();

			// ETH implicit accounts (0x + 40 hex chars)
			expect(() =>
				builder.setSigner("0x1234567890abcdef1234567890abcdef12345678"),
			).not.toThrow();

			// NEAR deterministic accounts (0s + 40 hex chars)
			expect(() =>
				builder.setSigner("0s1234567890abcdef1234567890abcdef12345678"),
			).not.toThrow();
		});

		it("throws error for invalid signer_id", () => {
			expect(() => builder.setSigner("user@near")).toThrow(
				'Invalid signer_id: "user@near" is not a valid NEAR account ID',
			);
		});

		it("sets deadline correctly", () => {
			const deadline = new Date("2025-12-31T23:59:59Z");
			builder.setDeadline(deadline);

			const state = builder.getState();
			expect(state.deadline).toEqual(deadline);
		});

		it("adds single intent", () => {
			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			builder.addIntent(intent);

			const state = builder.getState();
			expect(state.intents).toHaveLength(1);
			expect(state.intents[0]).toEqual(intent);
		});

		it("adds multiple intents", () => {
			const intents: IntentPrimitive[] = [
				{
					intent: "ft_withdraw",
					token: "usdc.omft.near",
					amount: "1000000",
					receiver_id: "user.near",
				},
				{
					intent: "ft_withdraw",
					token: "btc.omft.near",
					amount: "500000",
					receiver_id: "another.near",
				},
			];

			builder.addIntents(intents);

			const state = builder.getState();
			expect(state.intents).toHaveLength(2);
			expect(state.intents).toEqual(intents);
		});

		it("overrides verifying contract", () => {
			const customContract = "custom-intents.near";
			builder.setVerifyingContract(customContract);

			const state = builder.getState();
			expect(state.verifyingContract).toBe(customContract);
		});

		it("sets custom nonce", () => {
			const customNonce = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
			builder.setNonce(customNonce);

			const state = builder.getState();
			expect(state.customNonce).toBe(customNonce);
		});

		it("clears intents", () => {
			builder.addIntent({
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			});

			builder.clearIntents();

			const state = builder.getState();
			expect(state.intents).toHaveLength(0);
		});

		it("resets builder to initial state", () => {
			builder
				.setSigner("0x1234")
				.setDeadline(new Date())
				.addIntent({
					intent: "ft_withdraw",
					token: "usdc.omft.near",
					amount: "1000000",
					receiver_id: "user.near",
				})
				.setNonce("custom");

			builder.reset();

			const state = builder.getState();
			expect(state).toEqual(
				expect.objectContaining({
					signerId: undefined,
					deadline: undefined,
					intents: [],
					customNonce: undefined,
					verifyingContract: "intents.near",
				}),
			);
		});
	});

	describe("buildWithSalt", () => {
		it("builds payload with custom salt", () => {
			const signerId = "0x1234";
			const deadline = new Date("2025-12-31T23:59:59Z");
			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			const payload = builder
				.setSigner(signerId)
				.setDeadline(deadline)
				.addIntent(intent)
				.buildWithSalt(testSalt);

			expect(payload).toEqual({
				signer_id: signerId,
				deadline: deadline.toISOString(),
				verifying_contract: "intents.near",
				intents: [intent],
				nonce: expect.any(String),
			});
		});

		it("uses default deadline if not set", () => {
			const beforeBuild = Date.now();
			const payload = builder.buildWithSalt(testSalt);
			const afterBuild = Date.now();

			const deadlineTime = new Date(payload.deadline).getTime();
			expect(deadlineTime).toBeGreaterThanOrEqual(beforeBuild + 60000);
			expect(deadlineTime).toBeLessThanOrEqual(afterBuild + 60000 + 1000); // +1s tolerance
		});

		it("generates valid nonce", () => {
			const deadline = new Date("2025-12-31T23:59:59Z");
			const payload = builder.setDeadline(deadline).buildWithSalt(testSalt);

			// Verify nonce is valid by decoding it
			expect(() =>
				VersionedNonceBuilder.decodeNonce(payload.nonce),
			).not.toThrow();
		});

		it("uses custom nonce if provided", () => {
			const customNonce = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
			const payload = builder.setNonce(customNonce).buildWithSalt(testSalt);

			expect(payload.nonce).toBe(customNonce);
		});

		it("creates immutable intents array", () => {
			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			builder.addIntent(intent);
			const payload = builder.buildWithSalt(testSalt);

			// Modify original builder
			builder.addIntent({
				intent: "ft_withdraw",
				token: "btc.omft.near",
				amount: "500000",
				receiver_id: "another.near",
			});

			// Payload should not be affected
			expect(payload.intents).toHaveLength(1);
		});
	});

	describe("build", () => {
		it("fetches salt from salt manager", async () => {
			const payload = await builder.build();

			expect(mockSaltManager.getCachedSalt).toHaveBeenCalled();
			expect(payload.nonce).toBeTruthy();
		});

		it("builds complete payload", async () => {
			const signerId = "0x1234";
			const deadline = new Date("2025-12-31T23:59:59Z");
			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			const payload = await builder
				.setSigner(signerId)
				.setDeadline(deadline)
				.addIntent(intent)
				.build();

			expect(payload).toMatchObject({
				signer_id: signerId,
				deadline: deadline.toISOString(),
				verifying_contract: "intents.near",
				intents: [intent],
			});
			expect(payload.nonce).toBeTruthy();
		});
	});

	describe("buildAndSign", () => {
		it("builds and sign in one step", async () => {
			const mockSigner = {
				signIntent: vi.fn().mockResolvedValue({
					payload: "signed-payload",
					signature: "signature",
				}),
			};

			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			const multiPayload = await builder
				.setSigner("0x1234")
				.addIntent(intent)
				.buildAndSign(mockSigner);

			expect(mockSigner.signIntent).toHaveBeenCalled();
			expect(multiPayload).toBeTruthy();
		});
	});

	describe("clone", () => {
		it("creates independent copy", () => {
			const signerId = "0x1234";
			const deadline = new Date("2025-12-31T23:59:59Z");
			const intent: IntentPrimitive = {
				intent: "ft_withdraw",
				token: "usdc.omft.near",
				amount: "1000000",
				receiver_id: "user.near",
			};

			builder.setSigner(signerId).setDeadline(deadline).addIntent(intent);

			const cloned = builder.clone();

			// Modify cloned
			cloned.setSigner("0x5678");
			cloned.addIntent({
				intent: "ft_withdraw",
				token: "btc.omft.near",
				amount: "500000",
				receiver_id: "another.near",
			});

			// Original should be unchanged
			const originalState = builder.getState();
			expect(originalState.signerId).toBe(signerId);
			expect(originalState.intents).toHaveLength(1);

			// Cloned should have modifications
			const clonedState = cloned.getState();
			expect(clonedState.signerId).toBe("0x5678");
			expect(clonedState.intents).toHaveLength(2);
		});
	});

	describe("fluent interface", () => {
		it("supports method chaining", () => {
			const result = builder
				.setSigner("0x1234")
				.setDeadline(new Date())
				.addIntent({
					intent: "ft_withdraw",
					token: "usdc.omft.near",
					amount: "1000000",
					receiver_id: "user.near",
				})
				.clearIntents()
				.addIntents([
					{
						intent: "ft_withdraw",
						token: "btc.omft.near",
						amount: "500000",
						receiver_id: "another.near",
					},
				]);

			expect(result).toBe(builder);
		});
	});

	describe("environment configurations", () => {
		it("uses production contract for production env", () => {
			const productionBuilder = new IntentPayloadBuilder({
				env: "production",
				saltManager: mockSaltManager,
			});

			const state = productionBuilder.getState();
			expect(state.verifyingContract).toBe("intents.near");
		});

		it("uses staging contract for stage env", () => {
			const stageBuilder = new IntentPayloadBuilder({
				env: "stage",
				saltManager: mockSaltManager,
			});

			const state = stageBuilder.getState();
			expect(state.verifyingContract).toBe("staging-intents.near");
		});
	});

	describe("edge cases", () => {
		it("handles empty intents array", () => {
			const payload = builder.buildWithSalt(testSalt);
			expect(payload.intents).toEqual([]);
		});

		it("handles undefined signer_id", () => {
			const payload = builder.buildWithSalt(testSalt);
			expect(payload.signer_id).toBeUndefined();
		});

		it("preserves intent order", () => {
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
					amount: "2000000",
					receiver_id: "user2.near",
				},
				{
					intent: "ft_withdraw",
					token: "eth.omft.near",
					amount: "3000000",
					receiver_id: "user3.near",
				},
			];

			const payload = builder.addIntents(intents).buildWithSalt(testSalt);

			expect(payload.intents).toHaveLength(3);
			expect(payload.intents[0]?.token).toBe("usdc.omft.near");
			expect(payload.intents[1]?.token).toBe("btc.omft.near");
			expect(payload.intents[2]?.token).toBe("eth.omft.near");
		});
	});

	describe("type safety", () => {
		it("has required signer_id when setSigner is called", () => {
			const builderWithSigner = builder.setSigner("0x1234");
			const payload = builderWithSigner.buildWithSalt(testSalt);

			// Type assertion to verify the type is correct
			const signerId: string = payload.signer_id;
			expect(signerId).toBe("0x1234");
		});

		it("has optional signer_id when setSigner is not called", () => {
			const payload = builder.buildWithSalt(testSalt);

			// Type assertion - this should compile because signer_id is optional
			const signerId: string | undefined = payload.signer_id;
			expect(signerId).toBeUndefined();
		});

		it("maintains type safety through method chaining", () => {
			const payload = builder
				.addIntent({
					intent: "ft_withdraw",
					token: "usdc.omft.near",
					amount: "1000000",
					receiver_id: "user.near",
				})
				.setSigner("0x5678") // After this, signer_id becomes required
				.setDeadline(new Date())
				.buildWithSalt(testSalt);

			// Type is now IntentPayload & { signer_id: string }
			const signerId: string = payload.signer_id;
			expect(signerId).toBe("0x5678");
		});

		it("preserves type safety in async build", async () => {
			const builderWithSigner = builder.setSigner("test.near");
			const payload = await builderWithSigner.build();

			// Type assertion to verify the type is correct
			const signerId: string = payload.signer_id;
			expect(signerId).toBe("test.near");
		});

		it("preserves type safety in cloned builder", () => {
			const builderWithSigner = builder.setSigner("0xabcd");
			const cloned = builderWithSigner.clone();
			const payload = cloned.buildWithSalt(testSalt);

			// Type is preserved through clone
			const signerId: string = payload.signer_id;
			expect(signerId).toBe("0xabcd");
		});
	});
});

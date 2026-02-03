import type { EnvConfig } from "@defuse-protocol/internal-utils";
import { utils } from "@defuse-protocol/internal-utils";
import { VersionedNonceBuilder, type Salt } from "./expirable-nonce";
import type { ISaltManager } from "./interfaces/salt-manager";
import type {
	IntentPayload,
	IntentPrimitive,
	MultiPayload,
} from "./shared-types";
import type { IIntentSigner } from "./interfaces/intent-signer";
import { DEFAULT_DEADLINE_MS } from "./intent-payload-factory";

export interface IntentPayloadBuilderConfig {
	envConfig: EnvConfig;
	saltManager: ISaltManager;
}

/**
 * Type helper to make signer_id required when HasSigner is true
 */
type IntentPayloadWithSigner<HasSigner extends boolean> = HasSigner extends true
	? IntentPayload & { signer_id: string }
	: IntentPayload;

/**
 * Fluent builder for constructing intent payloads with environment context.
 * Provides a convenient API for generating intents that can be signed with different standards.
 *
 * @example
 * ```typescript
 * const sdk = new IntentsSDK({ env: 'production', referral: 'my-app' });
 *
 * // Build an intent payload
 * const payload = await sdk.intentBuilder()
 *   .setSigner('0x1234...') // EVM address or NEAR account
 *   .setDeadline(new Date(Date.now() + 5 * 60 * 1000)) // 5 minutes
 *   .addIntent({
 *     intent: 'ft_withdraw',
 *     token: 'usdc.omft.near',
 *     amount: '1000000',
 *     receiver_id: 'user.near'
 *   })
 *   .build();
 *
 * // Sign with your preferred method
 * const multiPayload = await signer.signIntent(payload);
 * ```
 */
export class IntentPayloadBuilder<HasSigner extends boolean = false> {
	private envConfig: EnvConfig;
	private saltManager: ISaltManager;
	private verifyingContract: string;
	private signerId?: string;
	private deadline?: Date;
	private intents: IntentPrimitive[] = [];
	private customNonce?: string;
	private customRandomBytes?: Uint8Array<ArrayBufferLike>;

	constructor(config: IntentPayloadBuilderConfig) {
		this.envConfig = config.envConfig;
		this.saltManager = config.saltManager;
		this.verifyingContract = this.envConfig.contractID;
	}

	/**
	 * Set the signer ID (address or account that will sign the intent).
	 * Can be an EVM address (for ERC191) or NEAR account ID (for NEP413).
	 *
	 * @param signerId - The identifier of the signer (must be a valid NEAR account ID)
	 * @returns The builder instance for chaining with updated type
	 * @throws Error if signerId is not a valid NEAR account ID
	 */
	setSigner(signerId: string): IntentPayloadBuilder<true> {
		if (!utils.validateNearAddress(signerId)) {
			throw new Error(
				`Invalid signer_id: "${signerId}" is not a valid NEAR account ID`,
			);
		}
		this.signerId = signerId;
		return this as IntentPayloadBuilder<true>;
	}

	/**
	 * Set the deadline for the intent expiration.
	 * If not set, defaults to 1 minute from build time.
	 *
	 * @param deadline - The expiration time for the intent
	 * @returns The builder instance for chaining
	 */
	setDeadline(deadline: Date): this {
		this.deadline = deadline;
		return this;
	}

	/**
	 * Add an intent to the payload.
	 * Multiple intents can be added and will execute atomically.
	 *
	 * @param intent - The intent primitive to add
	 * @returns The builder instance for chaining
	 */
	addIntent(intent: IntentPrimitive): this {
		this.intents.push(intent);
		return this;
	}

	/**
	 * Add multiple intents to the payload at once.
	 *
	 * @param intents - Array of intent primitives to add
	 * @returns The builder instance for chaining
	 */
	addIntents(intents: IntentPrimitive[]): this {
		this.intents.push(...intents);
		return this;
	}

	/**
	 * Override the verifying contract address.
	 * Use with caution - normally this is automatically set based on environment.
	 *
	 * @param contractAddress - The contract address to use
	 * @returns The builder instance for chaining
	 */
	setVerifyingContract(contractAddress: string): this {
		this.verifyingContract = contractAddress;
		return this;
	}

	/**
	 * Set a pre-built nonce directly.
	 * Use this when you have a complete nonce from an external source
	 * or need to reuse/invalidate a specific nonce.
	 *
	 * For most cases where you need custom random bytes, use {@link setNonceRandomBytes} instead,
	 * which handles salt fetching and nonce encoding automatically.
	 *
	 * @param nonce - Custom nonce string (base64 encoded)
	 * @returns The builder instance for chaining
	 */
	setNonce(nonce: string): this {
		this.customNonce = nonce;
		return this;
	}

	/**
	 * Set custom random bytes for nonce generation.
	 * The nonce will be automatically created at build time using these bytes,
	 * the deadline, and the contract salt.
	 *
	 * Use this when you need control over the random portion of the nonce
	 * (e.g., embedding a start timestamp via {@link VersionedNonceBuilder.createTimestampedNonceBytes}).
	 *
	 * For pre-built nonces, use {@link setNonce} instead.
	 *
	 * @param randomBytes - 15 bytes to use as the random portion of the nonce
	 * @returns The builder instance for chaining
	 */
	setNonceRandomBytes(randomBytes: Uint8Array<ArrayBufferLike>): this {
		this.customRandomBytes = randomBytes;
		return this;
	}

	/**
	 * Clear all intents from the builder.
	 *
	 * @returns The builder instance for chaining
	 */
	clearIntents(): this {
		this.intents = [];
		return this;
	}

	/**
	 * Reset the builder to its initial state.
	 * Keeps environment and salt manager but clears all user-set values.
	 *
	 * @returns The builder instance for chaining
	 */
	reset(): IntentPayloadBuilder<false> {
		this.signerId = undefined;
		this.deadline = undefined;
		this.intents = [];
		this.customNonce = undefined;
		this.customRandomBytes = undefined;
		this.verifyingContract = this.envConfig.contractID;
		return this as unknown as IntentPayloadBuilder<false>;
	}

	/**
	 * Build the intent payload using a custom salt.
	 * Use this method if you need explicit control over the salt.
	 *
	 * @param salt - The salt to use for nonce generation
	 * @returns The constructed intent payload with appropriate typing
	 */
	buildWithSalt(salt: Salt): IntentPayloadWithSigner<HasSigner> {
		const deadline =
			this.deadline ?? new Date(Date.now() + DEFAULT_DEADLINE_MS);
		const nonce =
			this.customNonce ??
			VersionedNonceBuilder.encodeNonce(
				salt,
				deadline,
				this.customRandomBytes,
			);

		return {
			verifying_contract: this.verifyingContract,
			signer_id: this.signerId,
			deadline: deadline.toISOString(),
			nonce,
			intents: [...this.intents],
		} as IntentPayloadWithSigner<HasSigner>;
	}

	/**
	 * Build the intent payload. Automatically fetches a fresh salt if needed.
	 * This is the recommended method for most use cases.
	 *
	 * @returns Promise resolving to the constructed intent payload with appropriate typing
	 */
	async build(): Promise<IntentPayloadWithSigner<HasSigner>> {
		const salt = await this.saltManager.getCachedSalt();
		return this.buildWithSalt(salt);
	}

	/**
	 * Build and sign the intent payload in one step.
	 * Convenience method that combines build() and signing.
	 *
	 * @param signer - The intent signer to use
	 * @returns Promise resolving to the signed multi-payload and the raw payload
	 */
	async buildAndSign(signer: IIntentSigner): Promise<{
		signed: MultiPayload;
		payload: IntentPayloadWithSigner<HasSigner>;
	}> {
		const payload = await this.build();
		const signed = await signer.signIntent(payload);
		return { signed, payload };
	}

	/**
	 * Create a new builder instance with the same configuration.
	 * Useful when you need multiple independent builders.
	 *
	 * @returns A new IntentPayloadBuilder instance
	 */
	clone(): IntentPayloadBuilder<HasSigner> {
		const builder = new IntentPayloadBuilder({
			envConfig: this.envConfig,
			saltManager: this.saltManager,
		}) as IntentPayloadBuilder<HasSigner>;

		builder.verifyingContract = this.verifyingContract;
		builder.signerId = this.signerId;
		builder.deadline = this.deadline;
		builder.intents = [...this.intents];
		builder.customNonce = this.customNonce;
		builder.customRandomBytes = this.customRandomBytes;

		return builder;
	}

	/**
	 * Get the current state of the builder as a plain object.
	 * Useful for debugging or inspecting the builder configuration.
	 *
	 * @returns Object containing the current builder state
	 */
	getState(): {
		envConfig: EnvConfig;
		verifyingContract: string;
		signerId?: string;
		deadline?: Date;
		intents: IntentPrimitive[];
		customNonce?: string;
	} {
		return {
			envConfig: this.envConfig,
			verifyingContract: this.verifyingContract,
			signerId: this.signerId,
			deadline: this.deadline,
			intents: [...this.intents],
			customNonce: this.customNonce,
		};
	}
}

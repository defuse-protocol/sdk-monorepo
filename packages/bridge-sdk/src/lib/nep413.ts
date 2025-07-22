import { BorshSchema, borshSerialize } from "borsher";

const nep413PayloadSchema = BorshSchema.Struct({
	message: BorshSchema.String,
	nonce: BorshSchema.Array(BorshSchema.u8, 32),
	recipient: BorshSchema.String,
	callback_url: BorshSchema.Option(BorshSchema.String),
});

export type NEP413Payload = typeof nep413PayloadSchema extends BorshSchema<
	infer T
>
	? Omit<T, "callback_url"> & { callback_url?: string | null | undefined }
	: never;

/**
 * Client-side utility to serialize and hash NEP-413 messages for EdDSA signature verification.
 * Follows the NEP-413 specification for message serialization and hashing:
 * @see https://github.com/near/NEPs/blob/master/neps/nep-0413.md#specification
 *
 * The resulting hash should be used with EdDSA signing to create a valid NEP-413 signature.
 * Note: This is a browser-only implementation.
 *
 * @param message - Message content to be signed
 * @param recipient - Recipient account ID
 * @param nonce - 32-byte nonce as a Uint8Array
 * @param callback_url - Optional callback URL to be used for the intent
 * @returns Promise resolving to Buffer containing message hash for signing
 */
export async function hashNEP413Message({
	message,
	recipient,
	nonce,
	callback_url,
}: NEP413Payload): Promise<Uint8Array> {
	const payload = {
		message: message,
		nonce: Array.from(nonce),
		recipient,
		callback_url,
	};

	// Serialize payload and combine with standard identifier
	const payloadSerialized = borshSerialize(nep413PayloadSchema, payload);
	const baseInt = 2 ** 31 + 413;
	const baseIntSerialized = borshSerialize(BorshSchema.u32, baseInt);

	// Combine serialized data
	const combinedData = new Uint8Array(
		baseIntSerialized.length + payloadSerialized.length,
	);
	combinedData.set(baseIntSerialized);
	combinedData.set(payloadSerialized, baseIntSerialized.length);

	// Hash the combined data
	const hashBuffer = await crypto.subtle.digest("SHA-256", combinedData);
	return new Uint8Array(hashBuffer);
}

import type { KeyPairString } from "near-api-js/lib/utils";
import * as v from "valibot";

export const env = v.parse(
	v.object({
		SECRET_EVM_PRIVATE_KEY: v.pipe(
			v.string(),
			v.startsWith("0x"),
			v.transform((a) => a as `0x${string}`),
		),
		SECRET_EVM_ADDRESS: v.pipe(
			v.string(),
			v.startsWith("0x"),
			v.transform((a) => a as `0x${string}`),
		),
		SECRET_NEAR_PRIVATE_KEY: v.pipe(
			v.string(),
			v.startsWith("ed25519:"),
			v.transform((a) => a as `${KeyPairString}:${string}`),
		),
		SECRET_NEAR_ACCOUNT_ID: v.string(),
	}),
	process.env,
);

import * as v from "valibot";
import type { ILogger } from "./logger";

interface SDKConfig {
	logger?: ILogger;
	env: EnvConfig;
	features: {
		hyperliquid: boolean;
	};
}

export interface EnvConfig {
	contractID: string;
	/**
	 * Static contract salt as hex string (e.g., "01020304").
	 * Use when salt is known ahead of time, e.g., for private blockchains
	 * where salt cannot be read from the contract.
	 * If not provided, salt will be fetched from the contract.
	 */
	contractSalt?: string;
	poaTokenFactoryContractID: string;
	poaBridgeBaseURL: string;
	solverRelayBaseURL: string;
	managerConsoleBaseURL: string;
	nearIntentsBaseURL: string;
}

const optionalUrlSchema = v.pipe(
	v.string(),
	v.check(
		(value) => value === "" || URL.canParse(value),
		"must be a valid URL or empty string",
	),
);

const envConfigSchema = v.object({
	contractID: v.pipe(v.string(), v.minLength(1, "contractID is required")),
	contractSalt: v.optional(v.pipe(v.string(), v.regex(/^[0-9a-fA-F]{8}$/))),
	poaTokenFactoryContractID: v.string(),
	poaBridgeBaseURL: optionalUrlSchema,
	solverRelayBaseURL: optionalUrlSchema,
	managerConsoleBaseURL: optionalUrlSchema,
	nearIntentsBaseURL: optionalUrlSchema,
});

export type NearIntentsEnv = "production" | "stage";

/**
 * Resolves environment configuration from either a preset name or custom config.
 * Defaults to "production" if no env is provided.
 *
 * @param env - Either "production"/"stage" preset name, or a custom EnvConfig object
 * @returns Resolved EnvConfig
 * @throws Error if custom config fails validation
 */
export function resolveEnvConfig(
	env: NearIntentsEnv | EnvConfig | undefined,
): EnvConfig {
	if (env === undefined) {
		return configsByEnvironment.production;
	}

	if (typeof env === "string") {
		return configsByEnvironment[env];
	}

	const result = v.safeParse(envConfigSchema, env);
	if (!result.success) {
		const issues = result.issues
			.map(
				(issue) =>
					`${issue.path?.map((p) => p.key).join(".")}: ${issue.message}`,
			)
			.join(", ");
		throw new Error(`Invalid EnvConfig: ${issues}`);
	}

	return result.output;
}

export const configsByEnvironment: Record<NearIntentsEnv, EnvConfig> = {
	production: {
		contractID: "intents.near",
		poaTokenFactoryContractID: "omft.near",
		poaBridgeBaseURL: "https://bridge.chaindefuser.com",
		solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
		managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
		nearIntentsBaseURL: "https://near-intents.org/api/",
	},
	stage: {
		contractID: "staging-intents.near",
		poaTokenFactoryContractID: "stft.near",
		poaBridgeBaseURL: "https://poa-stage.intents-near.org",
		solverRelayBaseURL: "https://solver-relay-stage.intents-near.org",
		managerConsoleBaseURL: "https://mng-console-stage.intents-near.org/api/",
		nearIntentsBaseURL: "https://stage.near-intents.org/api/",
	},
};

export let config: SDKConfig = {
	env: configsByEnvironment.production,
	features: {
		hyperliquid: false,
	},
};

export interface ConfigureSDKArgs {
	env?: EnvConfig | NearIntentsEnv;
	features?: { [K in keyof SDKConfig["features"]]?: boolean };
	environments?: Record<NearIntentsEnv, Partial<EnvConfig>>;
}

export function configureSDK({
	env,
	features,
	environments,
}: ConfigureSDKArgs): void {
	if (environments) {
		for (const [key, value] of Object.entries(environments)) {
			configsByEnvironment[key as NearIntentsEnv] = {
				...configsByEnvironment[key as NearIntentsEnv],
				...value,
			};
		}
	}

	if (env !== undefined) {
		config = { ...config, env: resolveEnvConfig(env) };
	}

	config = {
		...config,
		features: {
			...config.features,
			...features,
		},
	};
}

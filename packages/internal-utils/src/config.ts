import type { ILogger } from "./logger";

interface SDKConfig {
	logger?: ILogger;
	env: EnvConfig;
	features: {
		hyperliquid: boolean;
	};
	api: ApiConfig;
}

export interface ApiConfig {
	timeout: {
		default: number;
		bridgeFee: number;
		solverRelayPublishIntents: number;
	};
}

export interface EnvConfig {
	contractID: string;
	poaTokenFactoryContractID: string;
	poaBridgeBaseURL: string;
	solverRelayBaseURL: string;
	managerConsoleBaseURL: string;
	nearIntentsBaseURL: string;
}

export type NearIntentsEnv = "production" | "stage";

export const FRONT_END_API_CONFIGURATION = {
	timeout: {
		default: 10_000,
		bridgeFee: 10_000,
		solverRelayPublishIntents: 30_000,
	},
};

export const BACK_END_API_CONFIGURATION = {
	timeout: {
		default: 10_000,
		bridgeFee: 3_000,
		solverRelayPublishIntents: 30_000,
	},
};

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
	api:
		typeof window !== "undefined"
			? FRONT_END_API_CONFIGURATION
			: BACK_END_API_CONFIGURATION,
};

export interface ConfigureSDKArgs {
	env?: EnvConfig | NearIntentsEnv;
	features?: { [K in keyof SDKConfig["features"]]?: boolean };
	environments?: Record<NearIntentsEnv, Partial<EnvConfig>>;
	api?: ApiConfig;
}

export function configureSDK({
	env,
	features,
	environments,
	api,
}: ConfigureSDKArgs): void {
	if (environments) {
		for (const [key, value] of Object.entries(environments)) {
			configsByEnvironment[key as NearIntentsEnv] = {
				...configsByEnvironment[key as NearIntentsEnv],
				...value,
			};
		}
	}

	if (typeof env === "string") {
		config = { ...config, env: configsByEnvironment[env] };
	} else if (env) {
		config = { ...config, env };
	}

	config = {
		...config,
		features: {
			...config.features,
			...features,
		},
		api: {
			...config.api,
			...api,
		},
	};
}

import { type ILogger, setLogger } from "./logger";

interface SDKConfig {
	logger?: ILogger;
	env: EnvConfig;
	features: {
		hyperliquid: boolean;
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

export const configsByEnvironment: Record<NearIntentsEnv, EnvConfig> = {
	production: {
		contractID: "intents.near",
		poaTokenFactoryContractID: "omft.near",
		poaBridgeBaseURL: "https://bridge.chaindefuser.com",
		solverRelayBaseURL: "https://solver-relay-v2.chaindefuser.com",
		managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
		nearIntentsBaseURL: "https://app.near-intents.org/api/",
	},
	stage: {
		contractID: "staging-intents.near",
		poaTokenFactoryContractID: "stft.near",
		poaBridgeBaseURL: "http://34.105.197.59",
		solverRelayBaseURL: "http://35.242.147.168",
		managerConsoleBaseURL: "https://api-mng-console.chaindefuser.com/api/",
		nearIntentsBaseURL: "https://app.near-intents.org/api/",
	},
};

export let config: SDKConfig = {
	env: configsByEnvironment.production,
	features: {
		hyperliquid: false,
	},
};

export interface ConfigureSDKArgs {
	logger?: ILogger;
	env?: EnvConfig | NearIntentsEnv;
	features?: { [K in keyof SDKConfig["features"]]?: boolean };
}

export function configureSDK({
	logger,
	env,
	features,
}: ConfigureSDKArgs): void {
	if (logger) {
		setLogger(logger);
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
	};
}

export type sdkConfiguration = {
	apiTimeoutMs: number;
	solverRelayPublishIntentsTimeout: number;
};

export const FRONT_END_CONFIGURATION = {
	apiTimeoutMs: 10_000,
	solverRelayPublishIntentsTimeout: 30_000,
};

export const BACK_END_CONFIGURATION = {
	apiTimeoutMs: 3_000,
	solverRelayPublishIntentsTimeout: 30_000,
};

export function getSdkConfiguration() {
	return typeof window !== "undefined"
		? FRONT_END_CONFIGURATION
		: BACK_END_CONFIGURATION;
}

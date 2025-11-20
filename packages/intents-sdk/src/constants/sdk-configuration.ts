export type sdkConfiguration = {
	api: {
		timeout: {
			default: number;
			bridgeFee: number;
			solverRelayPublishIntents: number;
		};
	};
};

export const FRONT_END_CONFIGURATION = {
	api: {
		timeout: {
			default: 10_000,
			bridgeFee: 10_000,
			solverRelayPublishIntents: 30_000,
		},
	},
};

export const BACK_END_CONFIGURATION = {
	api: {
		timeout: {
			default: 10_000,
			bridgeFee: 3_000,
			solverRelayPublishIntents: 30_000,
		},
	},
};

export function getSdkConfiguration() {
	return typeof window !== "undefined"
		? FRONT_END_CONFIGURATION
		: BACK_END_CONFIGURATION;
}

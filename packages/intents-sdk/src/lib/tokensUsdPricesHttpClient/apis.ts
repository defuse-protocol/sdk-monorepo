import { request, configsByEnvironment } from "@defuse-protocol/internal-utils";
import type { RequestConfig, TokensUsdPricesPayload } from "./types";

export async function tokens(
	config: RequestConfig,
): Promise<TokensUsdPricesPayload> {
	const response = await request({
		url: new URL(
			"tokens",
			configsByEnvironment[config.env].managerConsoleBaseURL,
		),
		...config,
		fetchOptions: {
			...config.fetchOptions,
			method: "GET",
		},
	});

	return response.json();
}

import { logger } from "../../logger";
import { quote } from "../solverRelayHttpClient";

export async function quoteWithLog(
	params: Parameters<typeof quote>[0],
	{
		logBalanceSufficient,
		...config
	}: { logBalanceSufficient: boolean } & Parameters<typeof quote>[1],
) {
	const requestId = crypto.randomUUID();
	const result = await quote(params, { ...config, requestId });
	if (result == null) {
		logger.warn("quote: No liquidity available", { quoteParams: params });

		if (
			logBalanceSufficient &&
			// We don't care about fast quotes, since they fail often
			(params.wait_ms == null || params.wait_ms > 2500)
		) {
			logger.warn(
				"quote: No liquidity available for user with sufficient balance",
				{ quoteParams: params, quoteRequestInfo: { requestId } },
			);
		}
	}
	return result;
}

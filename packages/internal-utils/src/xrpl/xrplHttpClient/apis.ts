import { xrplRequest } from "./runtime";
import type {
	AccountInfoResponse,
	AccountLinesResponse,
	RequestConfig,
	TrustLine,
} from "./types";

export async function getAccountInfo(
	account: string,
	config: RequestConfig,
): Promise<AccountInfoResponse["result"]> {
	const data = (await xrplRequest(
		"account_info",
		{ account, ledger_index: "validated" },
		config,
	)) as AccountInfoResponse;
	return data.result;
}

export async function getAccountLines(
	account: string,
	config: RequestConfig,
): Promise<AccountLinesResponse["result"]> {
	const lines: TrustLine[] = [];
	let marker: unknown;

	do {
		const response = (await xrplRequest(
			"account_lines",
			{ account, ledger_index: "validated", marker },
			config,
		)) as AccountLinesResponse;

		lines.push(...response.result.lines);
		marker = response.result.marker;
	} while (marker !== undefined);

	return { lines };
}

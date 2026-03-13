import { xrplRequest } from "./runtime";
import {
	AccountInfoResponseSchema,
	AccountLinesResponseSchema,
	type AccountLinesResponse,
	type RequestConfig,
	type TrustLine,
} from "./types";

export async function getRequireDestinationTag(
	account: string,
	config: RequestConfig,
): Promise<boolean | undefined> {
	const data = await xrplRequest(
		"account_info",
		{ account, ledger_index: "validated" },
		config,
		AccountInfoResponseSchema,
	);
	return data.result.account_flags?.requireDestinationTag;
}

export async function getAccountLines(
	account: string,
	config: RequestConfig,
): Promise<AccountLinesResponse["result"]> {
	const lines: TrustLine[] = [];
	let marker: unknown;

	do {
		const response = await xrplRequest(
			"account_lines",
			{ account, ledger_index: "validated", marker },
			config,
			AccountLinesResponseSchema,
		);

		lines.push(...response.result.lines);
		marker = response.result.marker;
	} while (marker !== undefined);

	return { lines };
}

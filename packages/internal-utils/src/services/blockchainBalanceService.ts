import { base64 } from "@scure/base";
import type { providers } from "near-api-js";
import * as v from "valibot";
import { decodeQueryResult } from "../utils/near";

export const getNearNep141StorageBalance = async ({
	contractId,
	accountId,
	nearProvider,
}: {
	contractId: string;
	accountId: string;
	nearProvider: providers.Provider;
}): Promise<bigint> => {
	try {
		const args = { account_id: accountId };
		const argsBase64 = Buffer.from(JSON.stringify(args)).toString("base64");

		const response = await nearProvider.query({
			request_type: "call_function",
			method_name: "storage_balance_of",
			account_id: contractId,
			args_base64: argsBase64,
			finality: "optimistic",
		});

		const parsed = decodeQueryResult(
			response,
			v.union([v.null(), v.object({ total: v.string() })]),
		);

		return BigInt(parsed?.total || "0");
	} catch (err: unknown) {
		throw new Error("Error fetching balance", { cause: err });
	}
};

export const getNearNep141MinStorageBalance = async ({
	contractId,
	nearProvider,
}: {
	contractId: string;
	nearProvider: providers.Provider;
}): Promise<bigint> => {
	const response = await nearProvider.query({
		request_type: "call_function",
		method_name: "storage_balance_bounds",
		account_id: contractId,
		args_base64: base64.encode(new TextEncoder().encode(JSON.stringify({}))),
		finality: "optimistic",
	});

	const parsed = decodeQueryResult(
		response,
		v.object({ min: v.string(), max: v.string() }),
	);

	return BigInt(parsed.min);
};

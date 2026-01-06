import { BaseError } from "../../errors/base";
import type * as types from "../solverRelayHttpClient/types";

export type IntentSettlementErrorType = IntentSettlementError & {
	name: "IntentSettlementError";
};
export class IntentSettlementError extends BaseError {
	constructor(public result: types.GetStatusResponse["result"]) {
		super("Intent settlement failed.", {
			details: "Intent is published but not settled.",
			metaMessages: [
				`Status: ${result.status}`,
				`Intent hash: ${result.intent_hash}`,
				...("data" in result && result.data
					? [`Tx hash: ${result.data.hash}`]
					: []),
			],
			name: "IntentSettlementError",
		});
	}
}

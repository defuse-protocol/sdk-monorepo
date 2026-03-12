import type { ILogger } from "../../logger";
import type { RetryOptions } from "../../utils/retry";

export type RequestConfig = {
	baseURL: string;
	timeout?: number | undefined;
	retryOptions?: RetryOptions;
	logger?: ILogger;
};

export type AccountInfoResponse = {
	result: {
		account_data: {
			Account: string;
			Flags: number;
		};
		/**
		 * A map of account flags parsed out.
		 * Only available for rippled nodes 1.11.0 and higher.
		 */
		account_flags?: {
			requireDestinationTag: boolean;
		};
		validated?: boolean;
	};
};

export type TrustLine = {
	account: string;
	currency: string;
	limit: string;
	balance: string;
};

export type AccountLinesResponse = {
	result: {
		lines: TrustLine[];
		marker?: unknown;
	};
};

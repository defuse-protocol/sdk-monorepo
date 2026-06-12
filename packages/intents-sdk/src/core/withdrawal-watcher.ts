import {
	BaseError,
	type CompletionStats,
	type ILogger,
	poll,
	POLL_PENDING,
	PollTimeoutError,
} from "@defuse-protocol/internal-utils";
import type {
	Bridge,
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalIdentifier,
	WithdrawalParams,
} from "../shared-types";
import { getWithdrawalStatsForChain } from "../constants/withdrawal-timing";
import type { Provider } from "near-api-js/lib/providers";

const MAX_CONSECUTIVE_ERRORS = 5;

/**
 * Polling budget for fetching the NEAR intent tx status. The tx is already
 * submitted before watching starts, so a fetch only fails on transient RPC
 * errors: retry aggressively with a 15s ceiling. Persistent failures bail out
 * earlier via {@link MAX_CONSECUTIVE_ERRORS}.
 */
const NEAR_TX_STATUS_STATS: CompletionStats = {
	p50: 500,
	p90: 2_000,
	p99: 15_000,
};

export async function watchWithdrawal(args: {
	nearProvider: Provider;
	intentsContractId: string;
	bridge: Bridge;
	wid: WithdrawalIdentifier;
	signal?: AbortSignal;
	logger?: ILogger;
}): Promise<TxInfo | TxNoInfo> {
	const stats = getWithdrawalStatsForChain({
		chain: args.wid.landingChain,
		bridgeRoute: args.bridge.route,
	});
	let consecutiveErrors = 0;

	try {
		const nearFailureReason = await checkIfWithdrawalFailedOnNearSide({
			nearProvider: args.nearProvider,
			contractId: args.intentsContractId,
			txHash: args.wid.tx.hash,
			signal: args.signal,
			logger: args.logger,
		});

		if (nearFailureReason !== null) {
			args.logger?.error(
				`Withdrawal failed on NEAR side: ${nearFailureReason}`,
			);
			throw new NearWithdrawalFailedError(nearFailureReason);
		}

		return await poll(
			async () => {
				try {
					const status = await args.bridge.describeWithdrawal({
						...args.wid,
						logger: args.logger,
					});

					consecutiveErrors = 0;

					if (status.status === "completed") {
						return status.txHash != null
							? { hash: status.txHash }
							: { hash: null };
					}

					if (status.status === "failed") {
						throw new WithdrawalFailedError(status.reason);
					}

					return POLL_PENDING;
				} catch (err: unknown) {
					if (err instanceof WithdrawalFailedError) {
						throw err;
					}

					consecutiveErrors++;
					if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
						throw new WithdrawalWatchError(err);
					}

					args.logger?.warn(
						`Transient error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err}`,
					);
					return POLL_PENDING;
				}
			},
			{ stats, signal: args.signal },
		);
	} catch (err: unknown) {
		if (err instanceof PollTimeoutError) {
			throw new WithdrawalWatchError(err);
		}
		throw err;
	}
}

/**
 * Inspects the NEAR-side execution outcome of the withdrawal transaction.
 *
 * Fetches the tx status via {@link poll} so the request honors `signal` (it can
 * be aborted between attempts) and survives transient RPC errors, retrying up
 * to {@link MAX_CONSECUTIVE_ERRORS} times before failing with a
 * {@link WithdrawalWatchError}.
 *
 * Returns a human-readable reason when the transaction failed on NEAR, or
 * `null` when it succeeded. Throwing the terminal failure is intentionally left
 * to the caller: a non-null reason is meant to be wrapped in a
 * {@link NearWithdrawalFailedError}.
 */
async function checkIfWithdrawalFailedOnNearSide(args: {
	nearProvider: Provider;
	contractId: string;
	txHash: string;
	signal?: AbortSignal;
	logger?: ILogger;
}): Promise<string | null> {
	let consecutiveErrors = 0;

	const transaction = await poll(
		async () => {
			try {
				const tx = await args.nearProvider.txStatusReceipts(
					args.txHash,
					args.contractId,
					"FINAL",
				);
				consecutiveErrors = 0;

				// "NotStarted"/"Started" mean the tx hasn't reached a terminal
				// status yet — keep polling instead of treating it as a failure.
				if (tx.status === "NotStarted" || tx.status === "Started") {
					return POLL_PENDING;
				}
				return tx;
			} catch (err: unknown) {
				consecutiveErrors++;
				if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
					throw new WithdrawalWatchError(err);
				}

				args.logger?.warn(
					`Transient error fetching NEAR tx status (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}): ${err}`,
				);
				return POLL_PENDING;
			}
		},
		{ stats: NEAR_TX_STATUS_STATS, signal: args.signal },
	);

	// Pending statuses were filtered out while polling, so the status is now
	// terminal. It's a failure only on an explicit `Failure` — either the
	// detailed object form (`{ Failure }`) or the basic `"Failure"` string. A
	// `SuccessValue` (or any other terminal status) is not a NEAR-side failure.
	const status = transaction.status;
	if (typeof status === "object" && status?.Failure !== undefined) {
		const reason = `Withdrawal tx has status failed: ${JSON.stringify(status.Failure)}`;
		return reason;
	}

	for (const receipt of transaction.receipts_outcome) {
		const outcomeStatus = receipt.outcome.status;
		if (
			typeof outcomeStatus === "object" &&
			outcomeStatus.Failure !== undefined
		) {
			const reason = `Withdrawal tx has status failed: ${JSON.stringify(outcomeStatus.Failure)}`;
			return reason;
		}
	}

	return null;
}

export async function createWithdrawalIdentifiers(args: {
	bridges: Bridge[];
	withdrawalParams: WithdrawalParams[];
	intentTx: NearTxInfo;
}): Promise<{ bridge: Bridge; wid: WithdrawalIdentifier }[]> {
	const indexes = new Map<string, number>();
	const results: { bridge: Bridge; wid: WithdrawalIdentifier }[] = [];

	for (const w of args.withdrawalParams) {
		const bridge = await findBridgeForWithdrawal(args.bridges, w);
		if (bridge == null) {
			throw new BridgeNotFoundError();
		}

		const currentIndex = indexes.get(bridge.route) ?? 0;
		indexes.set(bridge.route, currentIndex + 1);

		const wid = bridge.createWithdrawalIdentifier({
			withdrawalParams: w,
			index: currentIndex,
			tx: args.intentTx,
		});

		results.push({ bridge, wid });
	}

	return results;
}

async function findBridgeForWithdrawal(
	bridges: Bridge[],
	params: WithdrawalParams,
): Promise<Bridge | undefined> {
	for (const bridge of bridges) {
		if (await bridge.supports(params)) {
			return bridge;
		}
	}
	return undefined;
}

export class BridgeNotFoundError extends BaseError {
	constructor() {
		super("Bridge adapter not found", {
			name: "BridgeNotFoundError",
		});
	}
}

export type WithdrawalFailedErrorType = WithdrawalFailedError & {
	name: "WithdrawalFailedError";
};

export class WithdrawalFailedError extends BaseError {
	constructor(reason: string) {
		super(`Withdrawal failed: ${reason}`, {
			name: "WithdrawalFailedError",
		});
	}
}

export type NearWithdrawalFailedErrorType = NearWithdrawalFailedError & {
	name: "NearWithdrawalFailedError";
};

export class NearWithdrawalFailedError extends BaseError {
	constructor(reason: string) {
		super(`Withdrawal failed on NEAR side: ${reason}`, {
			name: "NearWithdrawalFailedError",
		});
	}
}

export type WithdrawalWatchErrorType = WithdrawalWatchError & {
	name: "WithdrawalWatchError";
};

export class WithdrawalWatchError extends BaseError {
	constructor(cause: unknown) {
		super("Withdrawal watch failed", {
			name: "WithdrawalWatchError",
			cause,
		});
	}
}

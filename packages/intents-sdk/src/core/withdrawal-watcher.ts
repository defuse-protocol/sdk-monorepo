import {
	BaseError,
	type CompletionStats,
	type ILogger,
	poll,
	POLL_PENDING,
	PollTimeoutError,
	safeStringify,
	withTimeout,
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
import { providers } from "near-api-js";
import type { Provider } from "near-api-js/lib/providers";

const MAX_CONSECUTIVE_ERRORS = 5;

const NEAR_TX_STATUS_STATS: CompletionStats = {
	p50: 500,
	p90: 2_000,
	p99: 30_000,
};

const NEAR_TX_STATUS_FETCH_TIMEOUT_MS = 5_000;

/**
 * NEAR RPC error types that mean "the tx isn't observable as final yet" rather
 * than a real fetch failure: the queried node doesn't know the tx (propagation
 * lag) or its `wait_until=FINAL` wait timed out server-side. These are treated
 * as pending (keep polling), not as transient errors counted against
 * {@link MAX_CONSECUTIVE_ERRORS}.
 */
const NEAR_TX_PENDING_ERROR_TYPES = [
	"UNKNOWN_TRANSACTION",
	"TIMEOUT_ERROR",
] as const;

function isNearTxPendingError(err: unknown): boolean {
	return (
		err instanceof providers.TypedError &&
		NEAR_TX_PENDING_ERROR_TYPES.some((type) => type === err.type)
	);
}

/**
 * Per-attempt fetch timeout marker. A client-side timeout means "this node
 * didn't answer in time", which is the same "not observable as final yet"
 * situation as a server-side `TIMEOUT_ERROR` — so it's treated as pending (keep
 * polling), not as a transient failure counted against
 * {@link MAX_CONSECUTIVE_ERRORS}.
 */
class NearTxStatusFetchTimeoutError extends BaseError {
	constructor() {
		super("NEAR tx status fetch timed out", {
			name: "NearTxStatusFetchTimeoutError",
		});
	}
}

export async function watchWithdrawal(args: {
	nearProvider: Provider;
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
		const nearWithdrawalError = await checkIfWithdrawalFailedOnNearSide({
			nearProvider: args.nearProvider,
			// `sender_account_id` for tx status must be the account that signed the
			// settlement tx (the relayer), which `wid.tx.accountId` tracks — not the
			// verifying contract. Today they're the same (`intents.near`), but the
			// relayer account may change; this keeps the lookup correct if it does.
			senderAccountId: args.wid.tx.accountId,
			txHash: args.wid.tx.hash,
			signal: args.signal,
			logger: args.logger,
		});

		if (nearWithdrawalError !== null) {
			args.logger?.error(nearWithdrawalError.message);
			throw nearWithdrawalError;
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
	senderAccountId: string;
	txHash: string;
	signal?: AbortSignal;
	logger?: ILogger;
}): Promise<NearWithdrawalFailedError | null> {
	try {
		let consecutiveErrors = 0;

		const transaction = await poll(
			async ({ remainingMs }) => {
				try {
					const tx = await withTimeout(
						() =>
							args.nearProvider.txStatusReceipts(
								args.txHash,
								args.senderAccountId,
								"FINAL",
							),
						{
							timeout: Math.min(NEAR_TX_STATUS_FETCH_TIMEOUT_MS, remainingMs),
							errorInstance: new NearTxStatusFetchTimeoutError(),
						},
					);
					consecutiveErrors = 0;

					// "NotStarted"/"Started" mean the tx hasn't reached a terminal
					// status yet — keep polling instead of treating it as a failure.
					if (tx.status === "NotStarted" || tx.status === "Started") {
						return POLL_PENDING;
					}
					return tx;
				} catch (err: unknown) {
					// A definitive "not yet known / not yet final" RPC response — or a
					// client-side per-attempt timeout — is an expected pending signal,
					// not a failure: keep polling without spending the transient-error
					// budget.
					if (
						isNearTxPendingError(err) ||
						err instanceof NearTxStatusFetchTimeoutError
					) {
						consecutiveErrors = 0;
						return POLL_PENDING;
					}

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
			{
				stats: NEAR_TX_STATUS_STATS,
				signal: args.signal,
				// Cap the backoff: a not-yet-final/not-yet-visible tx resolves on a
				// ~1-2s timescale, so retry promptly instead of letting poll escalate
				// to its default 10s COLD interval.
				maxInterval: 1_000,
			},
		);

		// Pending statuses were filtered out while polling, so the status is now
		// terminal. It's a failure only on an explicit `Failure` — either the
		// detailed object form (`{ Failure }`) or the basic `"Failure"` string. A
		// `SuccessValue` (or any other terminal status) is not a NEAR-side failure.
		const status = transaction.status;
		if (typeof status === "object" && status?.Failure !== undefined) {
			return new NearWithdrawalFailedError(safeStringify(status.Failure));
		}
		if (status === "Failure") {
			return new NearWithdrawalFailedError("Near tx has status failed");
		}

		for (const receipt of transaction.receipts_outcome) {
			const outcomeStatus = receipt.outcome.status;
			if (
				typeof outcomeStatus === "object" &&
				outcomeStatus.Failure !== undefined
			) {
				return new NearWithdrawalFailedError(
					safeStringify(outcomeStatus.Failure),
				);
			}
			if (outcomeStatus === "Failure") {
				return new NearWithdrawalFailedError("Near tx has status failed");
			}
		}

		return null;
	} catch (error) {
		return new NearWithdrawalFailedError(
			`Checking Near withdrawal tx failed unexpectedly: ${safeStringify(error)}`,
		);
	}
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

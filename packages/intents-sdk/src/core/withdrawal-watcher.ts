import {
	BaseError,
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

const MAX_CONSECUTIVE_ERRORS = 3;

export async function watchWithdrawal(args: {
	bridge: Bridge;
	wid: WithdrawalIdentifier;
	signal?: AbortSignal;
	logger?: ILogger;
}): Promise<TxInfo | TxNoInfo> {
	const stats = getWithdrawalStatsForChain(args.wid.landingChain);
	let consecutiveErrors = 0;

	try {
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

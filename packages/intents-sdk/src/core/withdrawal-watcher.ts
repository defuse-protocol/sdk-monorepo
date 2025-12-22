import {
	BaseError,
	type ILogger,
	poll,
	POLL_PENDING,
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

export async function watchWithdrawal(args: {
	bridge: Bridge;
	wid: WithdrawalIdentifier;
	signal?: AbortSignal;
	logger?: ILogger;
}): Promise<TxInfo | TxNoInfo> {
	const stats = getWithdrawalStatsForChain(args.wid.landingChain);

	return poll(
		async () => {
			try {
				const status = await args.bridge.describeWithdrawal({
					...args.wid,
					logger: args.logger,
				});

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

				args.logger?.warn(`Transient error while watching withdrawal: ${err}`);
				return POLL_PENDING;
			}
		},
		{ stats, signal: args.signal },
	);
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

export class WithdrawalPendingError extends BaseError {
	constructor() {
		super("Withdrawal is still pending", {
			name: "WithdrawalPendingError",
		});
	}
}

export class WithdrawalFailedError extends BaseError {
	constructor(reason: string) {
		super(`Withdrawal failed: ${reason}`, {
			name: "WithdrawalFailedError",
		});
	}
}

import { retry } from "@lifeomic/attempt";
import {
	BaseError,
	type ILogger,
	type RetryOptions,
} from "@defuse-protocol/internal-utils";
import type {
	Bridge,
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalIdentifier,
	WithdrawalParams,
} from "../shared-types";
import { getRetryOptionsForChain } from "./chain-retry";

export async function watchWithdrawal(args: {
	bridge: Bridge;
	descriptor: WithdrawalIdentifier;
	signal?: AbortSignal;
	retryOptions?: RetryOptions;
	logger?: ILogger;
}): Promise<TxInfo | TxNoInfo> {
	const retryOpts =
		args.retryOptions ?? getRetryOptionsForChain(args.descriptor.landingChain);

	return retry(
		async () => {
			args.signal?.throwIfAborted();

			const status = await args.bridge.describeWithdrawal({
				...args.descriptor,
				logger: args.logger,
			});

			if (status.status === "completed") {
				return status.txHash != null ? { hash: status.txHash } : { hash: null };
			}

			if (status.status === "failed") {
				throw new WithdrawalFailedError(status.reason);
			}

			throw new WithdrawalPendingError();
		},
		{
			...retryOpts,
			handleError: (err: unknown, ctx) => {
				if (args.signal?.aborted && err === args.signal?.reason) {
					ctx.abort();
					return;
				}

				if (err instanceof WithdrawalFailedError) {
					ctx.abort();
					return;
				}

				if (!(err instanceof WithdrawalPendingError)) {
					args.logger?.warn(
						`Transient error while watching withdrawal: ${err}`,
					);
				}
			},
		},
	);
}

export async function createWithdrawalIdentifiers(args: {
	bridges: Bridge[];
	withdrawalParams: WithdrawalParams[];
	intentTx: NearTxInfo;
}): Promise<{ bridge: Bridge; descriptor: WithdrawalIdentifier }[]> {
	const indexes = new Map<string, number>();
	const results: { bridge: Bridge; descriptor: WithdrawalIdentifier }[] = [];

	for (const w of args.withdrawalParams) {
		const bridge = await findBridgeForWithdrawal(args.bridges, w);
		if (bridge == null) {
			throw new BridgeNotFoundError();
		}

		const currentIndex = indexes.get(bridge.route) ?? 0;
		indexes.set(bridge.route, currentIndex + 1);

		const descriptor = bridge.createWithdrawalIdentifier({
			withdrawalParams: w,
			index: currentIndex,
			tx: args.intentTx,
		});

		results.push({ bridge, descriptor });
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

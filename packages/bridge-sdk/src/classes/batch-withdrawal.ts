import type { RetryOptions } from "@defuse-protocol/internal-utils";
import type { ILogger } from "@defuse-protocol/internal-utils";
import { stringify } from "viem";
import type { IIntentExecuter } from "../intents/interfaces/intent-executer";
import type { IntentRelayParamsFactory } from "../intents/shared-types";
import { drop, zip } from "../lib/array";
import { assert } from "../lib/assert";
import { determineRouteConfig } from "../lib/route-config";
import type {
	BatchWithdrawal,
	FeeEstimation,
	IBridgeSDK,
	NearTxInfo,
	TxInfo,
	TxNoInfo,
	WithdrawalIdentifier,
	WithdrawalParams,
} from "../shared-types";
import { FeeExceedsAmountError } from "./errors";

export class BatchWithdrawalImpl<
	Ticket,
	RelayParams extends { quoteHashes: string[] },
> implements BatchWithdrawal<Ticket>
{
	protected withdrawalParams: WithdrawalParams[];
	protected referral: string | undefined;
	protected bridgeSDK: IBridgeSDK;
	protected intentExecuter: IIntentExecuter<Ticket, RelayParams>;
	protected intentRelayParams?: IntentRelayParamsFactory<RelayParams>;
	protected logger?: ILogger;

	protected feeEstimations: PromiseSettledResult<FeeEstimation>[] | null = null;
	protected intentTicket: Ticket | null = null;
	protected intentTx: NearTxInfo | null = null;
	protected destinationTx: PromiseSettledResult<TxInfo | TxNoInfo>[] | null =
		null;

	constructor(args: {
		withdrawalParams: WithdrawalParams[];
		referral?: string;
		bridgeSDK: IBridgeSDK;
		intentExecuter: IIntentExecuter<Ticket, RelayParams>;
		intentRelayParams?: IntentRelayParamsFactory<RelayParams>;
		logger?: ILogger;
	}) {
		this.withdrawalParams = args.withdrawalParams;
		this.referral = args.referral;
		this.bridgeSDK = args.bridgeSDK;
		this.intentExecuter = args.intentExecuter;
		this.intentRelayParams = args.intentRelayParams;
		this.logger = args.logger;
	}

	async process(): Promise<void> {
		await this.estimateFee();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("fee =", this.feeEstimations);

		await this.signAndSendIntent();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("intent ticket =", this.intentTicket);

		await this.waitForIntentSettlement();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("intent tx =", this.intentTx);

		const wids = this.getWithdrawalsIdentifiers();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log(
			"withdrawals =",
			wids.map((w) => `${stringify(w.routeConfig)} ${w.index}`).join(","),
		);

		await this.waitForWithdrawalCompletion();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("destination tx =", this.destinationTx);
	}

	addWithdrawal(args: {
		withdrawalParams: WithdrawalParams;
		feeEstimation?: FeeEstimation;
	}): void {
		if (args.feeEstimation != null) {
			if (this.feeEstimations == null) {
				this.feeEstimations = Array(this.withdrawalParams.length).fill({
					status: "rejected",
					reason: new Error("Fee is not estimated"),
				});
			}

			this.feeEstimations.push({
				status: "fulfilled",
				value: args.feeEstimation,
			});
		}

		this.withdrawalParams.push(args.withdrawalParams);
	}

	getWithdrawal(index: number): { withdrawalParams: WithdrawalParams } | null {
		const withdrawalParams = this.withdrawalParams[index];
		if (withdrawalParams == null) {
			return null;
		}
		return { withdrawalParams };
	}

	withdrawalsCount(): number {
		return this.withdrawalParams.length;
	}

	async estimateFee(): Promise<PromiseSettledResult<bigint>[]> {
		this.feeEstimations = await Promise.allSettled(
			this.withdrawalParams.map((withdrawalParams) => {
				return this.bridgeSDK.estimateWithdrawalFee({
					withdrawalParams,
				});
			}),
		);

		for (const feeEstimation of this.feeEstimations) {
			if (feeEstimation.status === "rejected") {
				if (!(feeEstimation.reason instanceof FeeExceedsAmountError)) {
					throw feeEstimation.reason;
				}
			}
		}

		return this.feeEstimations.map((v) => {
			return v.status === "fulfilled"
				? { status: "fulfilled", value: v.value.amount }
				: v.reason;
		});
	}

	getUnprocessableWithdrawals(): WithdrawalParams[] {
		if (this.feeEstimations != null) {
			const failedEstimationIndexes = Array.from(this.feeEstimations.entries())
				.filter(([, v]) => v.status === "rejected")
				.map(([i]) => i);

			return this.withdrawalParams.filter((_, i) =>
				failedEstimationIndexes.includes(i),
			);
		}

		return [];
	}

	hasUnprocessableWithdrawals(): boolean {
		return this.getUnprocessableWithdrawals().length > 0;
	}

	removeUnprocessableWithdrawals(): WithdrawalParams[] {
		const withdrawalParams = this.getUnprocessableWithdrawals();

		if (this.feeEstimations != null) {
			const failedEstimationIndexes = Array.from(this.feeEstimations.entries())
				.filter(([, v]) => v.status === "rejected")
				.map(([i]) => i);

			this.feeEstimations = drop(this.feeEstimations, failedEstimationIndexes);
			this.withdrawalParams = drop(
				this.withdrawalParams,
				failedEstimationIndexes,
			);
		}

		return withdrawalParams;
	}

	async signAndSendIntent(): Promise<Ticket> {
		const feeEstimations = this.feeEstimations;

		if (feeEstimations == null) {
			throw new Error("Fee is not estimated");
		}
		if (this.hasUnprocessableWithdrawals()) {
			throw new Error("There are unprocessable withdrawals");
		}

		const intents = (
			await Promise.all(
				zip(this.withdrawalParams, feeEstimations).map(
					([withdrawalParams, feeEstimation]) => {
						assert(
							feeEstimation.status === "fulfilled",
							"Fee is not fulfilled",
						);

						return this.bridgeSDK.createWithdrawalIntents({
							withdrawalParams: withdrawalParams,
							feeEstimation: feeEstimation.value,
							referral: this.referral,
							logger: this.logger,
						});
					},
				),
			)
		).flat();

		const { ticket } = await this.intentExecuter.signAndSendIntent({
			intents,
			// @ts-expect-error
			relayParams: async () => {
				const relayParams =
					this.intentRelayParams != null
						? await this.intentRelayParams()
						: { quoteHashes: undefined };

				const quoteHashes = relayParams.quoteHashes ?? [];

				for (const fee of feeEstimations) {
					if (fee.status === "fulfilled" && fee.value.quote != null) {
						quoteHashes.push(fee.value.quote.quote_hash);
					}
				}

				return {
					...relayParams,
					quoteHashes: quoteHashes,
				};
			},
		});

		this.intentTicket = ticket;
		return this.intentTicket;
	}

	async waitForIntentSettlement(): Promise<NearTxInfo> {
		if (this.intentTicket == null) {
			throw new Error("Intent is not published");
		}

		const { tx } = await this.intentExecuter.waitForSettlement(
			this.intentTicket,
		);

		this.intentTx = tx;
		return this.intentTx;
	}

	getWithdrawalsIdentifiers(): WithdrawalIdentifier[] {
		const intentTx = this.intentTx;
		if (intentTx == null) {
			throw new Error("Intent is not published or not settled");
		}

		const indexes = new Map<string, number>(
			zip(
				this.withdrawalParams.map((w) => {
					const routeConfig = determineRouteConfig(this.bridgeSDK, w);
					return routeConfig.route;
				}),
				Array(this.withdrawalParams.length).fill(0),
			),
		);

		return this.withdrawalParams.map((w): WithdrawalIdentifier => {
			const routeConfig = determineRouteConfig(this.bridgeSDK, w);
			const route = routeConfig.route;

			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const index = indexes.get(route)!;
			indexes.set(route, index + 1);

			return {
				routeConfig: routeConfig,
				index,
				tx: intentTx,
			};
		});
	}

	async waitForWithdrawalCompletion({
		signal,
		retryOptions,
	}: {
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	} = {}): Promise<PromiseSettledResult<TxInfo | TxNoInfo>[]> {
		this.destinationTx = await Promise.allSettled(
			this.getWithdrawalsIdentifiers().map((w) => {
				return this.bridgeSDK.waitForWithdrawalCompletion({
					...w,
					signal,
					retryOptions,
				});
			}),
		);
		return this.destinationTx;
	}
}

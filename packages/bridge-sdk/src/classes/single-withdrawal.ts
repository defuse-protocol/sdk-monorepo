import type { RetryOptions } from "@defuse-protocol/internal-utils";
import type { ILogger } from "@defuse-protocol/internal-utils";
import { stringify } from "viem";
import type { IIntentExecuter } from "../intents/interfaces/intent-executer";
import type { IntentRelayParamsFactory } from "../intents/shared-types";
import { determineRouteConfig } from "../lib/route-config";
import type {
	FeeEstimation,
	IBridgeSDK,
	NearTxInfo,
	SingleWithdrawal,
	TxInfo,
	TxNoInfo,
	WithdrawalIdentifier,
	WithdrawalParams,
} from "../shared-types";

export class SingleWithdrawalImpl<
	Ticket,
	RelayParams extends { quoteHashes: string[] },
> implements SingleWithdrawal<Ticket>
{
	protected withdrawalParams: WithdrawalParams;
	protected referral: string | undefined;
	protected bridgeSDK: IBridgeSDK;
	protected intentExecuter: IIntentExecuter<Ticket, RelayParams>;
	protected intentRelayParams?: IntentRelayParamsFactory<RelayParams>;
	protected logger?: ILogger;

	protected feeEstimation: FeeEstimation | null = null;
	protected intentTicket: Ticket | null = null;
	protected intentTx: NearTxInfo | null = null;
	protected destinationTx: TxInfo | TxNoInfo | null = null;

	constructor(args: {
		withdrawalParams: WithdrawalParams;
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
		console.log("fee =", this.feeEstimation);

		await this.signAndSendIntent();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("intent ticket =", this.intentTicket);

		await this.waitForIntentSettlement();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("intent tx =", this.intentTx);

		const wid = this.getWithdrawalIdentifier();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("withdrawals =", `${stringify(wid.routeConfig)} ${wid.index}`);

		await this.waitForWithdrawalCompletion();
		// biome-ignore lint/suspicious/noConsole: <explanation>
		console.log("destination tx =", this.destinationTx);
	}

	async estimateFee(): Promise<bigint> {
		this.feeEstimation = await this.bridgeSDK.estimateWithdrawalFee({
			withdrawalParams: this.withdrawalParams,
		});
		return this.feeEstimation.amount;
	}

	async signAndSendIntent(): Promise<Ticket> {
		const feeEstimation = this.feeEstimation;

		if (feeEstimation == null) {
			throw new Error("Fee is not estimated");
		}

		const intents = await this.bridgeSDK.createWithdrawalIntents({
			withdrawalParams: this.withdrawalParams,
			feeEstimation: feeEstimation,
			referral: this.referral,
			logger: this.logger,
		});

		const { ticket } = await this.intentExecuter.signAndSendIntent({
			intents,
			// @ts-expect-error
			relayParams: async () => {
				const relayParams =
					this.intentRelayParams != null
						? await this.intentRelayParams()
						: { quoteHashes: undefined };

				const quoteHashes = relayParams.quoteHashes ?? [];

				if (feeEstimation.quote) {
					quoteHashes.push(feeEstimation.quote.quote_hash);
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

	getWithdrawalIdentifier(): WithdrawalIdentifier {
		const intentTx = this.intentTx;
		if (intentTx == null) {
			throw new Error("Intent is not published or not settled");
		}

		return {
			routeConfig: determineRouteConfig(this.bridgeSDK, this.withdrawalParams),
			index: 0,
			tx: intentTx,
		};
	}

	async waitForWithdrawalCompletion({
		signal,
		retryOptions,
	}: {
		signal?: AbortSignal;
		retryOptions?: RetryOptions;
	} = {}): Promise<TxInfo | TxNoInfo> {
		this.destinationTx = await this.bridgeSDK.waitForWithdrawalCompletion({
			...this.getWithdrawalIdentifier(),
			signal,
			retryOptions,
		});
		return this.destinationTx;
	}
}

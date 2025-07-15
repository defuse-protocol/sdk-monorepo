import type { ILogger } from "@defuse-protocol/internal-utils";
import type { NearTxInfo } from "../../shared-types";
import type { RelayParamsDefault } from "../shared-types";

export interface IIntentRelayer<Ticket, RelayParams = RelayParamsDefault> {
	publishIntent(
		params: RelayParams,
		ctx?: { logger?: ILogger },
	): Promise<Ticket>;

	waitForSettlement(
		ticket: Ticket,
		ctx?: { logger?: ILogger },
	): Promise<{ tx: NearTxInfo }>;
}

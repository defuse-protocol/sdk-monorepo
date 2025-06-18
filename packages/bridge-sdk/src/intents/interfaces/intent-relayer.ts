import type { NearTxInfo } from "../../shared-types";
import type { RelayParamsDefault } from "../shared-types";

export interface IIntentRelayer<Ticket, RelayParams = RelayParamsDefault> {
	publishIntent(params: RelayParams): Promise<Ticket>;

	waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }>;
}

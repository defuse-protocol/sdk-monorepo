import type { NearTxInfo } from "../../shared-types.ts";
import type { RelayParamsDefault } from "../shared-types.ts";

export interface IIntentRelayer<Ticket, RelayParams = RelayParamsDefault> {
	publishIntent(params: RelayParams): Promise<Ticket>;

	waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }>;
}

import type { NearTxInfo } from "../../shared-types.ts";
import type {
	IntentPayloadFactory,
	IntentRelayParamsFactory,
	RelayParamsDefault,
} from "../shared-types.ts";

export interface IIntentExecuter<Ticket, RelayParams = RelayParamsDefault> {
	signAndSendIntent(
		args: Parameters<IntentPayloadFactory>[0] & {
			relayParams?: IntentRelayParamsFactory<RelayParams>;
		},
	): Promise<{ ticket: Ticket }>;

	waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }>;
}

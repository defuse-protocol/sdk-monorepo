import type { NearTxInfo } from "../../shared-types";
import type { Salt } from "../expirable-nonce";
import type {
	IntentPayloadFactory,
	IntentRelayParamsFactory,
	RelayParamsDefault,
} from "../shared-types";

export interface IIntentExecuter<Ticket, RelayParams = RelayParamsDefault> {
	signAndSendIntent(
		args: Parameters<IntentPayloadFactory>[0] & {
			relayParams?: IntentRelayParamsFactory<RelayParams>;
			salt: Salt;
		},
	): Promise<{ ticket: Ticket }>;

	waitForSettlement(ticket: Ticket): Promise<{ tx: NearTxInfo }>;
}

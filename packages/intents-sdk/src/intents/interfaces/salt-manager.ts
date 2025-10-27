import type { Salt } from "../expirable-nonce";
import type { IntentPayload, MultiPayload } from "../shared-types";

export interface ISaltManager {
	getCachedSalt(): Promise<Salt>;
}

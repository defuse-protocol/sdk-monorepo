import type { Result } from "@thames/monads";
import type { AuthMethodValue } from "../types/authHandle";
import type { WalletSignatureResult } from "../types/walletMessage";
import { assert } from "../utils/assert";
import { prepareSwapSignedData } from "../utils/prepareBroadcastRequest";
import {
	type PublishIntentsErrorType,
	type PublishIntentsReturnType,
	publishIntents,
} from "./publishIntents";

export type PublishIntentReturnType = PublishIntentsReturnType[number];
export type PublishIntentErrorType = PublishIntentsErrorType;

export function publishIntent(
	signatureData: WalletSignatureResult,
	userInfo: { userAddress: string; userChainType: AuthMethodValue },
	quoteHashes: string[],
): Promise<Result<PublishIntentReturnType, PublishIntentErrorType>> {
	return publishIntents({
		signed_datas: [prepareSwapSignedData(signatureData, userInfo)],
		quote_hashes: quoteHashes,
	}).then((result) => {
		return result.map((intentHashes) => {
			const intentHash = intentHashes[0];
			assert(intentHash != null, "Should include at least one intent hash");
			return intentHash;
		});
	});
}

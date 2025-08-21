import { utils } from "@defuse-protocol/internal-utils";
import { UnsupportedAssetIdError } from "../classes/errors";

export function parseDefuseAssetId(
	assetId: string,
): utils.ParseDefuseAssetIdReturnType {
	try {
		return utils.parseDefuseAssetId(assetId);
	} catch {
		throw new UnsupportedAssetIdError(assetId, "Invalid asset id format.");
	}
}

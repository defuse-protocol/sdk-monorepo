import { execSync } from "node:child_process";
import { access } from "node:fs/promises";
// biome-ignore lint/style/noRestrictedImports: temporary
import { constants } from "node:fs";
import type { TeeResult } from "./tee";
// biome-ignore lint/style/noRestrictedImports: temporary
import path from "node:path";
import type { Hex } from "viem";

export type OutLayerMessage = {
	message: Hex;
};

export class Outlayer {
	// TODO: remove
	readonly PROTECTED_SEED =
		"f909b4aa7bdcb86e5d087f64ac3c448b29faf79009861fe8fbfde5a2ddf03653ed93f9ef27f7b74780aa48f042e44c0f7e29be6e043522abe684ef0112ae2c77";

	async send(message: OutLayerMessage): Promise<Hex> {
		// biome-ignore lint/style/noRestrictedGlobals: temporary
		const binary = path.resolve(__dirname, "./near-pds");
		try {
			await access(binary, constants.X_OK);
			// File exists and is executable
		} catch {
			throw new Error("Binary not found or not executable");
		}
		const json = JSON.stringify(message);

		const cmd = `echo '${json}' | PROTECTED_SEED=${this.PROTECTED_SEED} ${binary}`;
		const output = execSync(cmd).toString();
		const { result, error } = JSON.parse(output) as TeeResult;
		if (error) {
			throw new Error(error);
		}

		return result;
	}
}

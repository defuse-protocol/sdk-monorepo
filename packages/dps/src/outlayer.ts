import { execSync } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import type { TeeResult } from "./tee";
import path from "node:path";
import type { Hex } from "viem";

export class Outlayer {
    readonly seed;
    constructor(seed: string) {
        this.seed = seed;
    }

    async send(message: string): Promise<Hex | null> {
        const binary = path.resolve(__dirname, './near-pds');
        try {
            await access(binary, constants.X_OK);
            // File exists and is executable
        } catch {
            console.error("Binary not found or not executable");
        }
        const json = JSON.stringify({ message })

        try {   
            const cmd = `echo '${message}' | PROTECTED_SEED=${this.seed} ${binary}`;
            const output = execSync(cmd).toString();
            const {result} = JSON.parse(output) as TeeResult;

            return result;
        } catch (error) {
            console.error(error);
        }

        return null;
    }
}
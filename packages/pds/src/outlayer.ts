import { execSync } from "node:child_process";
import type { TeeResult } from "./tee";
import type { Hex } from "viem";

export class Outlayer {
	async send(message: string): Promise<Hex> {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			method: "outlayer_execute",
			params: [message],
			id: 1,
		});
		const url = "http://localhost:3110/rpc";
		// console.log(`curl -X POST -H 'Content-type:application/json' -d '${body}' ${url}`)
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
		});
		const json = await response.json();

		const { result, error } = json.result;
		if (error) {
			throw new Error(error);
		}
		return result;
	}
}

import type { Hex } from "viem";
import type { TeeProvider } from "./tee-provider";

export class Outlayer implements TeeProvider {
	readonly url;
	constructor(url: string) {
		this.url = url;
	}
	async send(message: string): Promise<Hex> {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			method: "outlayer_execute",
			params: [message],
			id: 1,
		});
		// console.log(
		// 	`curl -X POST -H 'Content-type:application/json' -d '${body}' ${this.url}`,
		// );
		const response = await fetch(this.url, {
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

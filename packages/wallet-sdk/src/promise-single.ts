import { base64 } from "@scure/base";
import type { PromiseSingle as PromiseSingleType } from "./types/wallet";

export class PromiseSingle {
	constructor() {}

	private basePromiseSingle(
		payload_v2: { Eddsa: string } | { Ed25519: string },
	): PromiseSingleType[] {
		const argsJson = JSON.stringify({
			request: {
				payload_v2,
				// todo customize
				domain_id: 1,
			},
		});
		const argsBase64 = base64.encode(new TextEncoder().encode(argsJson));

		return [
			{
				receiver_id: "v1.signer",
				actions: [
					{
						action: "function_call",
						function_name: "sign",
						args: argsBase64,
						deposit: "1000000000000000000000000",
					},
				],
			},
		];
	}

	eddsaPromise(custom_payload: string): PromiseSingleType[] {
		return this.basePromiseSingle({ Eddsa: custom_payload });
	}
}

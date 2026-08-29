import type { NearPromise, Request } from "./types/wallet";
import { base64, hex } from "@scure/base";

export enum DomainId {
	Secp256k1 = 0,
	Ed25519 = 1,
}

export class MpcContract {
	private readonly contractId;

	constructor(contractId?: string) {
		this.contractId = contractId ?? "v1.signer";
	}

	private buildSignMpcPromiseSingle(
		domainId: DomainId,
		payload: Uint8Array,
		path: string,
	): NearPromise {
		const hexPayload = hex.encode(payload);

		let payload_v2: { Ecdsa: string } | { Eddsa: string };
		switch (domainId) {
			case DomainId.Secp256k1: {
				if (payload.length !== 32) {
					throw new Error(
						"Invalid payload length for Secp256k1. Expected length 32",
					);
				}
				payload_v2 = { Ecdsa: hexPayload };
				break;
			}
			case DomainId.Ed25519: {
				if (payload.length < 32 || payload.length > 1232) {
					throw new Error(
						"Invalid payload length for Ed25519. Expected length must be between 32 and 1232",
					);
				}

				payload_v2 = { Eddsa: hexPayload };
				break;
			}
		}

		const argsJson = JSON.stringify({
			request: {
				payload_v2,
				domain_id: domainId,
				path,
			},
		});

		return {
			receiver_id: this.contractId,
			actions: [
				{
					action: "function_call",
					payload: {
						function_name: "sign",
						args: base64.encode(new TextEncoder().encode(argsJson)),
						deposit: "1",
					},
				},
			],
		};
	}

	buildSignMpcRequest(
		domainId: DomainId,
		payload: Uint8Array,
		path: string = "",
	): Request {
		return {
			internal: [],
			external: [this.buildSignMpcPromiseSingle(domainId, payload, path)],
		};
	}
}

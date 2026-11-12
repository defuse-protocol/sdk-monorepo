import type { GlobalContractId } from "./types/state";
import { base58, base64, base64url, hex } from "@scure/base";
import { StateInit, WalletState } from "./wallet-state";
import { p256 } from "@noble/curves/nist";
import { serializeRequestMessage } from "./borsh/serialize";
import type { Request, RequestMessage } from "./types/wallet";
import { DomainId } from "./mpc-contract";
import type { OneClickClient } from "./oneclick-client";
import { sha3_256 } from "@noble/hashes/sha3";

type WalletContractOptions = {
	walletId?: number;
	timeoutSecs?: number;
	extensions?: string[];
};

abstract class WalletContract {
	public readonly DEFAULT_WALLET_ID: number = 0;
	public readonly DEFAULT_TIMEOUT_SECS: number = 60 * 60;

	protected readonly WALLET_DOMAIN: Uint8Array = new TextEncoder().encode(
		"NEAR_WALLET_CONTRACT/V1",
	);

	private readonly _walletId: number;
	private readonly _timeoutSecs: number;
	private readonly _extensions: string[];

	private _nonce: number = 0;
	protected readonly client: OneClickClient;

	constructor(client: OneClickClient, options?: WalletContractOptions) {
		this.client = client;

		this._walletId = options?.walletId ?? this.DEFAULT_WALLET_ID;
		this._timeoutSecs = options?.timeoutSecs ?? this.DEFAULT_TIMEOUT_SECS;
		this._extensions = options?.extensions ?? [];
	}

	abstract get publicKeyBytes(): Uint8Array;

	abstract get globalContractId(): GlobalContractId;

	get nextNonce(): number {
		const BIT_POS_MASK: number = 0b11111;

		if ((this._nonce & BIT_POS_MASK) === 0) {
			this._nonce =
				(Math.floor(Math.random() * 0xffffffff) & ~BIT_POS_MASK) >>> 0;
		}

		const n = this._nonce;
		this._nonce++;
		return n;
	}

	get accountId(): string {
		return this.stateInit().deriveAccountId();
	}

	private stateInit(): StateInit {
		const state = new WalletState(this.publicKeyBytes, {
			walletId: this._walletId,
			timeoutSecs: this._timeoutSecs,
			extensions: this._extensions,
		});
		return new StateInit(this.globalContractId, state.toStorage());
	}

	buildRequestMessage(request: Request): RequestMessage {
		return {
			chain_id: "mainnet",
			signer_id: this.accountId,
			nonce: this.nextNonce,
			created_at: new Date(Math.floor(Date.now() / 1000 - 60) * 1000)
				.toISOString()
				.replace(/\.\d{3}Z$/, "Z"),
			timeout_secs: this._timeoutSecs,
			request,
		};
	}

	async sendSign(opts: {
		message: RequestMessage;
		proof: string;
	}): Promise<{ status: number; body: string }> {
		const deterministicStateInit = this.stateInit().toJSON();

		return await this.client.sign({
			msg: opts.message,
			proof: opts.proof,
			deterministicStateInit,
		});
	}

	async derivePublicKey(path: string, domainId: DomainId): Promise<string> {
		let domain_str: string;
		switch (domainId) {
			case DomainId.Secp256k1:
				domain_str = "secp256k1";
				break;
			case DomainId.Ed25519:
				domain_str = "ed25519";
				break;
			default:
				throw new Error("Unknown domain id");
		}

		return this.client.derivePublicKey({
			path,
			domainId: domain_str,
			predecessor: this.accountId,
		});
	}
}

abstract class WalletWebAuthn extends WalletContract {
	abstract parseSignature(derHex: string): string;

	challenge(requestMessage: RequestMessage): string {
		const contractPrefix = this.WALLET_DOMAIN;
		const borshBytes = serializeRequestMessage(requestMessage);
		const prefixed = new Uint8Array(contractPrefix.length + borshBytes.length);
		prefixed.set(contractPrefix);
		prefixed.set(borshBytes, contractPrefix.length);
		return base64.encode(sha3_256(prefixed));
	}

	buildProof(response: AuthenticatorAssertionResponse) {
		const signatureHex = hex.encode(new Uint8Array(response.signature));
		return JSON.stringify({
			authenticator_data: base64url.encode(
				new Uint8Array(response.authenticatorData),
			),
			client_data_json: new TextDecoder().decode(
				new Uint8Array(response.clientDataJSON),
			),
			signature: this.parseSignature(signatureHex),
		});
	}
}

export class WalletWebAuthnP256 extends WalletWebAuthn {
	private readonly _publicKeyBytes: Uint8Array;

	/**
	 * @param client - OneClickClient for HTTP calls.
	 * @param _publicKeyBytes - Compressed SEC1 encoded coordinates.
	 * @param options
	 */
	constructor(
		client: OneClickClient,
		_publicKeyBytes: string,
		options?: WalletContractOptions,
	) {
		super(client, options);
		// For P-256 uncompressed keys (65 bytes), compress to 33 bytes
		this._publicKeyBytes = p256.Point.fromHex(_publicKeyBytes).toBytes(true);
	}

	get globalContractId(): GlobalContractId {
		return {
			account_id: "0s32a5a14fe27b132f13eeacb99ba12fb77f6c4cda",
		};
	}

	get publicKeyBytes(): Uint8Array {
		return this._publicKeyBytes;
	}

	parseSignature(derHex: string): string {
		// Normalize to low-S: the on-chain contract rejects high-S signatures
		const sig = p256.Signature.fromBytes(
			hex.decode(derHex),
			"der",
		).normalizeS();
		return `p256:${base58.encode(sig.toBytes("compact"))}`;
	}
}

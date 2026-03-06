import type { GlobalContractId } from "./types/state";
import { base58, base64, base64url, hex } from "@scure/base";
import { StateInit, WalletState } from "./wallet-state";
import { p256 } from "@noble/curves/p256";
import { serializeRequestMessage } from "./borsh/serialize";
import { sha256 } from "@noble/hashes/sha2";
import type { RequestMessage, Request } from "./types/wallet";
import { DomainId } from "./mpc-contract";
import type { OneClickClient } from "./oneclick-client";

abstract class WalletContract {
	// todo remove
	public seqno: number = 0;
	public readonly walletId: number;
	public readonly extensions: string[];
	protected readonly client: OneClickClient;

	constructor(
		client: OneClickClient,
		_walletId: number = 0,
		_extensions: string[] = [],
	) {
		this.client = client;
		this.walletId = _walletId;
		this.extensions = _extensions;
	}

	abstract publicKeyBytes(): Uint8Array;

	abstract globalContractId(): GlobalContractId;

	protected walletDomain() {
		return new TextEncoder().encode("NEAR_WALLET_CONTRACT/V1");
	}

	deriveAccountId(): string {
		return this.stateInit().deriveAccountId();
	}

	private stateInit(): StateInit {
		return new StateInit(
			this.globalContractId(),
			new WalletState(this.publicKeyBytes(), {
				walletId: this.walletId,
				extensions: this.extensions,
			}).toStorage(),
		);
	}

	async buildRequestMessage(
		request: Request,
		timeout_secs: number = 60,
	): Promise<RequestMessage> {
		return {
			chain_id: "mainnet",
			request,
			// TODO async poll from relayer
			seqno: this.seqno,
			signer_id: this.deriveAccountId(),
			valid_until: new Date(
				Math.floor(Date.now() / 1000) * 1000 + timeout_secs * 1000,
			)
				.toISOString()
				.replace(/\.\d{3}Z$/, "Z"),
		};
	}

	async sendSign(opts: {
		message: RequestMessage;
		proof: string;
	}): Promise<{ status: number; body: string }> {
		const stateInit = this.stateInit().toJSON();

		const result = await this.client.sign({
			msg: opts.message,
			proof: opts.proof,
			stateInit,
		});

		// todo remove
		this.seqno++;

		return result;
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
			predecessor: this.deriveAccountId(),
		});
	}
}

abstract class WalletWebAuthn extends WalletContract {
	abstract parseSignature(derHex: string): string;

	challenge(requestMessage: RequestMessage): string {
		const contractPrefix = this.walletDomain();
		const borshBytes = serializeRequestMessage(requestMessage);
		const prefixed = new Uint8Array(contractPrefix.length + borshBytes.length);
		prefixed.set(contractPrefix);
		prefixed.set(borshBytes, contractPrefix.length);
		return base64.encode(sha256(prefixed));
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
			public_key: hex.encode(this.publicKeyBytes()),
		});
	}
}

export class WalletWebAuthnP256 extends WalletWebAuthn {
	private readonly _publicKeyBytes: Uint8Array;

	/**
	 * @param client - OneClickClient for HTTP calls.
	 * @param _publicKeyBytes - Compressed SEC1 encoded coordinates.
	 */
	constructor(client: OneClickClient, _publicKeyBytes: string) {
		super(client);
		// For P-256 uncompressed keys (65 bytes), compress to 33 bytes
		this._publicKeyBytes =
			p256.ProjectivePoint.fromHex(_publicKeyBytes).toRawBytes(true);
	}

	globalContractId(): GlobalContractId {
		return {
			hash: [
				...hex.decode(
					"8f028370f5ac3da4aa123a986819fef9ed565eef9d3b03d6634ca94e28e5b476",
				),
			],
		};
	}

	publicKeyBytes(): Uint8Array {
		return this._publicKeyBytes;
	}

	parseSignature(derHex: string): string {
		// Normalize to low-S: the on-chain contract rejects high-S signatures
		const sig = p256.Signature.fromDER(derHex).normalizeS();
		return `p256:${base58.encode(sig.toCompactRawBytes())}`;
	}
}

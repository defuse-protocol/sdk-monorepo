import type { GlobalContractId } from "./types/state";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58, base64, hex } from "@scure/base";

export type Storage = Map<Uint8Array, Uint8Array>;

class BorshWriter {
	private buf: number[] = [];

	writeU8(value: number): void {
		this.buf.push(value & 0xff);
	}

	writeBool(value: boolean): void {
		this.writeU8(value ? 1 : 0);
	}

	writeU32(value: number): void {
		this.buf.push(
			value & 0xff,
			(value >> 8) & 0xff,
			(value >> 16) & 0xff,
			(value >> 24) & 0xff,
		);
	}

	writeU64(value: bigint): void {
		let v = value;
		for (let i = 0; i < 8; i++) {
			this.buf.push(Number(v & 0xffn));
			v >>= 8n;
		}
	}

	writeString(value: string): void {
		const bytes = new TextEncoder().encode(value);
		this.writeU32(bytes.length);
		for (const b of bytes) {
			this.writeU8(b);
		}
	}

	writeRawBytes(value: Uint8Array): void {
		for (const b of value) {
			this.writeU8(b);
		}
	}

	writeBytes(value: Uint8Array): void {
		this.writeU32(value.length);
		this.writeRawBytes(value);
	}

	toBytes(): Uint8Array {
		return new Uint8Array(this.buf);
	}
}

export class WalletState {
	public readonly DEFAULT_WALLET_ID = 0;
	public signature_enabled: boolean;
	public subwallet_id: number;
	public public_key: Uint8Array;
	public timeout_secs: number;
	public extensions: string[];

	constructor(
		publicKeyBytes: Uint8Array,
		options?: {
			walletId?: number;
			timeoutSecs?: number;
			extensions?: string[];
		},
	) {
		this.signature_enabled = true;
		this.subwallet_id = options?.walletId ?? this.DEFAULT_WALLET_ID;
		this.public_key = publicKeyBytes;
		this.timeout_secs = options?.timeoutSecs ?? 60 * 60;
		this.extensions = options?.extensions ?? [];
	}

	toStorage(): Storage {
		const STATE_KEY: Uint8Array = Uint8Array.from([]);
		const serialized = this.borshSerialize();

		return new Map([[STATE_KEY, serialized]]);
	}

	private borshSerialize(): Uint8Array {
		const w = new BorshWriter();
		const extensions = [...new Set(this.extensions)].sort();

		w.writeBool(this.signature_enabled);
		w.writeU32(this.subwallet_id);
		w.writeRawBytes(this.public_key);
		w.writeU32(this.timeout_secs);
		w.writeU64(0n);
		w.writeU32(0);
		w.writeU32(0);
		w.writeU32(extensions.length);
		for (const extension of extensions) {
			w.writeString(extension);
		}

		return w.toBytes();
	}
}

export class StateInit {
	public code: GlobalContractId;
	public data: Storage;

	constructor(_code: GlobalContractId, _data: Storage) {
		this.data = _data;
		this.code = _code;
	}

	toJSON() {
		let code: { hash: string } | { account_id: string };
		if ("hash" in this.code) {
			code = { hash: base58.encode(new Uint8Array(this.code.hash)) };
		} else {
			code = { account_id: this.code.account_id };
		}
		return {
			V1: {
				code,
				data: Object.fromEntries(
					this.sortedEntries(this.data).map(([k, v]) => [
						base64.encode(k),
						base64.encode(v),
					]),
				),
			},
		};
	}

	private sortedEntries(
		map: Map<Uint8Array, Uint8Array>,
	): [Uint8Array, Uint8Array][] {
		return [...map.entries()].sort(([a], [b]) => {
			const len = Math.min(a.length, b.length);
			for (let i = 0; i < len; i++) {
				const aByte = a[i] ?? 0;
				const bByte = b[i] ?? 0;
				if (aByte !== bByte) return aByte - bByte;
			}
			return a.length - b.length;
		});
	}

	private borshSerialize(): Uint8Array {
		const w = new BorshWriter();
		w.writeU8(0);

		if ("hash" in this.code) {
			w.writeU8(0);
			w.writeRawBytes(new Uint8Array(this.code.hash));
		} else {
			w.writeU8(1);
			w.writeString(this.code.account_id);
		}

		const entries = this.sortedEntries(this.data);
		w.writeU32(entries.length);
		for (const [key, value] of entries) {
			w.writeBytes(key);
			w.writeBytes(value);
		}

		return w.toBytes();
	}

	deriveAccountId(): string {
		const hash = keccak_256(this.borshSerialize());
		return `0s${hex.encode(hash.slice(12, 32))}`;
	}
}

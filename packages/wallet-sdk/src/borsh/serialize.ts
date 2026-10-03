import { base64 } from "@scure/base";
import type {
	NearPromise,
	PromiseAction,
	RequestMessage,
	StateInit,
	WalletOp,
} from "../types/wallet";
import type { GlobalContractId } from "../types/state";

// todo borsh write
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

	writeU128(value: bigint): void {
		let v = value;
		for (let i = 0; i < 16; i++) {
			this.buf.push(Number(v & 0xffn));
			v >>= 8n;
		}
	}

	writeString(value: string): void {
		const bytes = new TextEncoder().encode(value);
		this.writeU32(bytes.length);
		for (const b of bytes) {
			this.buf.push(b);
		}
	}

	writeBytes(value: Uint8Array | number[]): void {
		this.writeU32(value.length);
		for (const b of value) {
			this.buf.push(b);
		}
	}

	writeOption<T>(value: T | undefined | null, write: (val: T) => void): void {
		if (value == null) {
			this.writeU8(0);
		} else {
			this.writeU8(1);
			write(value);
		}
	}

	toBytes(): Uint8Array {
		return new Uint8Array(this.buf);
	}
}

export function serializeRequestMessage(msg: RequestMessage): Uint8Array {
	const w = new BorshWriter();
	w.writeString(msg.chain_id);
	w.writeString(msg.signer_id);
	w.writeU32(msg.nonce);
	w.writeU64(timestampToNanoseconds(msg.created_at));
	w.writeU32(msg.timeout_secs);
	writeRequest(w, msg.request);
	return w.toBytes();
}

function timestampToNanoseconds(value: string): bigint {
	const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(
		value,
	);
	if (match) {
		const wholeSeconds = match[1];
		if (wholeSeconds == null) {
			throw new Error(`Invalid timestamp: ${value}`);
		}
		const milliseconds = Date.parse(`${wholeSeconds}.000Z`);
		if (!Number.isFinite(milliseconds)) {
			throw new Error(`Invalid timestamp: ${value}`);
		}
		const fraction = `${match[2] ?? ""}000000000`.slice(0, 9);
		return BigInt(milliseconds) * 1_000_000n + BigInt(fraction);
	}

	const milliseconds = Date.parse(value);
	if (!Number.isFinite(milliseconds)) {
		throw new Error(`Invalid timestamp: ${value}`);
	}
	return BigInt(milliseconds) * 1_000_000n;
}

function writeRequest(w: BorshWriter, req: RequestMessage["request"]): void {
	w.writeU32(req.internal.length);
	for (const op of req.internal) {
		writeWalletOp(w, op);
	}
	w.writeU32(req.external.length);
	for (const promise of req.external) {
		writeNearPromise(w, promise);
	}
}

function writeNearPromise(w: BorshWriter, ps: NearPromise): void {
	w.writeString(ps.receiver_id);
	w.writeOption(ps.refund_to, (v) => w.writeString(v));
	w.writeU32(ps.actions.length);
	for (const action of ps.actions) {
		writePromiseAction(w, action);
	}
}

function writePromiseAction(w: BorshWriter, action: PromiseAction): void {
	switch (action.action) {
		case "function_call": {
			const payload = action.payload;
			w.writeU8(2);
			w.writeString(payload.function_name);
			w.writeBytes(base64.decode(payload.args ?? ""));
			w.writeU128(BigInt(payload.deposit ?? "0"));
			w.writeU64(BigInt(payload.gas ?? "0"));
			w.writeU64(BigInt(payload.gas_weight ?? "1"));
			break;
		}
		case "transfer": {
			w.writeU8(3);
			w.writeU128(BigInt(action.payload.amount));
			break;
		}
		case "deterministic_state_init": {
			const payload = action.payload;
			w.writeU8(11);
			writeStateInit(w, payload.state_init);
			w.writeU128(BigInt(payload.deposit ?? "0"));
			break;
		}
	}
}

function writeWalletOp(w: BorshWriter, op: WalletOp): void {
	switch (op.op) {
		case "set_signature_mode":
			w.writeU8(0);
			w.writeBool(op.payload.enable);
			break;
		case "add_extension":
			w.writeU8(1);
			w.writeString(op.payload.account_id);
			break;
		case "remove_extension":
			w.writeU8(2);
			w.writeString(op.payload.account_id);
			break;
	}
}

function writeStateInit(w: BorshWriter, si: StateInit): void {
	// StateInit enum: V1 = discriminant 0
	w.writeU8(0);
	writeGlobalContractId(w, si.V1.code);
	// HashMap<Vec<u8>, Vec<u8>>
	const entries = [...si.V1.data.entries()];
	w.writeU32(entries.length);
	for (const [key, value] of entries) {
		w.writeBytes(key);
		w.writeBytes(value);
	}
}

function writeGlobalContractId(w: BorshWriter, id: GlobalContractId): void {
	if ("hash" in id) {
		w.writeU8(0);
		// Fixed-size array [u8; 32] — no length prefix
		for (const b of id.hash) {
			w.writeU8(b);
		}
	} else {
		w.writeU8(1);
		w.writeString(id.account_id);
	}
}

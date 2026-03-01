import { base64 } from "@scure/base";
import type {
	PromiseAction,
	PromiseDag,
	PromiseSingle,
	RequestMessage,
	StateInit,
	WalletOp,
} from "../types/wallet";
import type { WalletGlobalContractId } from "../types/state";

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
	w.writeU32(msg.seqno);
	// valid_until: ISO string -> epoch seconds u32
	w.writeU32(Math.floor(new Date(msg.valid_until).getTime() / 1000));
	writeRequest(w, msg.request);
	return w.toBytes();
}

function writeRequest(w: BorshWriter, req: RequestMessage["request"]): void {
	w.writeU32(req.ops.length);
	for (const op of req.ops) {
		writeWalletOp(w, op);
	}
	writePromiseDag(w, req.out);
}

function writePromiseDag(w: BorshWriter, dag: PromiseDag): void {
	w.writeU32(dag.after.length);
	for (const sub of dag.after) {
		writePromiseDag(w, sub);
	}
	w.writeU32(dag.then.length);
	for (const single of dag.then) {
		writePromiseSingle(w, single);
	}
}

function writePromiseSingle(w: BorshWriter, ps: PromiseSingle): void {
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
			w.writeU8(2);
			w.writeString(action.function_name);
			w.writeBytes(base64.decode(action.args));
			w.writeU128(BigInt(action.deposit));
			w.writeU64(BigInt(action.min_gas ?? "0"));
			w.writeU64(BigInt(action.gas_weight ?? "1"));
			break;
		}
		case "transfer": {
			w.writeU8(3);
			w.writeU128(BigInt(action.amount));
			break;
		}
		case "state_init": {
			w.writeU8(11);
			writeStateInit(w, action.state_init);
			w.writeU128(BigInt(action.deposit));
			break;
		}
	}
}

function writeWalletOp(w: BorshWriter, op: WalletOp): void {
	switch (op.op) {
		case "set_signature_mode":
			w.writeU8(0);
			w.writeBool(op.enable);
			break;
		case "add_extension":
			w.writeU8(1);
			w.writeString(op.account_id);
			break;
		case "remove_extension":
			w.writeU8(2);
			w.writeString(op.account_id);
			break;
		case "custom":
			w.writeU8(255);
			w.writeBytes(op.args);
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

function writeGlobalContractId(
	w: BorshWriter,
	id: WalletGlobalContractId,
): void {
	if ("CodeHash" in id) {
		w.writeU8(0);
		// Fixed-size array [u8; 32] — no length prefix
		for (const b of id.CodeHash) {
			w.writeU8(b);
		}
	} else {
		w.writeU8(1);
		w.writeString(id.AccountId);
	}
}

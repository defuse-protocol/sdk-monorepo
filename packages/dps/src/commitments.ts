import { sha256, type ByteArray, type Hex } from "viem";
import type { EvmCommitmentParameters } from "./types";

export function getSerializedArray(cp: Array<string>): ByteArray {
	const encoder = new TextEncoder();
	const combinedBytes: Array<number> = [];
	
	cp.map((str) => combinedBytes.push(...encoder.encode(str)));
	
	return Uint8Array.from(combinedBytes);
}

export function getEvmCommitmentHash(cp: EvmCommitmentParameters): Hex {
	const strings = Object.values(cp).map(value => value.toString().toLowerCase());
	const serialized = getSerializedArray(strings);
	
	return sha256(serialized, "hex");
}
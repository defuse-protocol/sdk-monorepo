import { sha256 } from "viem";

export function getCommitmentHash(cp: EvmCommitmentParameters): Hex {
	const commitmentParamsStrings = [
		cp.chainId.toString(),
		cp.token.toString(),
		cp.value.toString(),
		cp.calldata,
		// TODO: add refundTo
	];

	const encoder = new TextEncoder();
	const combinedBytes: Array<number> = [];
	commitmentParamsStrings.map((str) =>
		combinedBytes.push(...encoder.encode(str)),
	);
	const combined = Uint8Array.from(combinedBytes);
	return sha256(combined, "hex");
}
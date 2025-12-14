import type { Address, Hex } from "viem";

export type EvmCommitmentParameters = {
	chainId: number;
	token: Address;
	value: bigint;
	calldata: Hex;
	// TODO: refundTo: Address;
};

export type EvmForwardingParameters = {
	nonce: bigint;
	gasPrice: bigint;
	gasLimit: bigint;
};

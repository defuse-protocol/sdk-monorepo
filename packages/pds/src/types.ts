import type { Address, Hex } from "viem";



export type EvmForwardingParameters = {
	nonce: bigint;
	gasPrice: bigint;
	gasLimit: bigint;
};

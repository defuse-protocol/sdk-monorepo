import type { Address, Hex } from "viem";

// Keep this order
export type EvmCommitmentParameters = {
    chainId: Number;
    token: Address;
    value: bigint;
    calldata: Hex;
    // TODO: refundTo: Address;
};

export type EvmForwardingParameters = {
    nonce: BigInt,
    gasLimit: BigInt,
    gasPrice: BigInt,
}
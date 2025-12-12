import type { Address, Hex } from "viem";

export enum Protocol = {
    EVM: 1,
    
}

export type EvmCommitmentParameters = {
    chainId: Number;
    refundTo: Address;
    token: Address;
    value: bigint;
    calldata: Hex;
};
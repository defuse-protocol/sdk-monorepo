import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { Tee } from "./tee";
import type { EvmCommitmentParameters } from "./types";

describe("TEE abstraction tests", () => {
    describe("generateDPSEvmAddress()", () => {
        it("Should generate the expected address", async () => {
            const publicKey = "0x039400c7dc419576781027d5aeddebaee22088172b18b76f2c3e53ca1765e19c4b";
            const chainCode = "0x1e3f0f00431911762a5e0dd43d928265c77fec6e4d49f18232d9e57ab13fd91a";
            const expectedAddress = "0x4dD16013943f8868233106A45e623018265c6cBD";
            const treasury = "0xCEf67989ae740cC9c92fa7385F003F84EAAFd915";
            const token = "0xdac17f958d2ee523a2206206994597c13d831ec7";
            const amount = 306002n;
            const chainId = 1;
            const value = 0n;
            const calldata = encodeFunctionData({
                abi: parseAbi(["function transfer(address, uint256)"]),
                functionName: "transfer",
                args: [treasury, amount],
            });
            const commitmentParams: EvmCommitmentParameters = {
                chainId,
                token,
                value,
                calldata,
            }

            const tee = new Tee(publicKey, chainCode);
            const result = tee.generateDPSEvmAddress(commitmentParams);
            
            expect(result).toEqual(expectedAddress);
        })
    })
})
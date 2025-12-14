import { describe, expect, it } from "vitest";
import {
	encodeFunctionData,
	parseAbi,
	parseTransaction,
	recoverTransactionAddress,
	type TransactionSerialized,
} from "viem";
import { ProtocolCode, Tee } from "./tee";
import type { EvmCommitmentParameters } from "./types";

describe("TEE abstraction tests", () => {
	describe("initialize()", () => {
		it("Should initialize the TEE successfully", async () => {
			const tee = new Tee();
			const initData = await tee.initialize({ protocol: ProtocolCode.EVM });

			const expectedChainCode =
				"0x9c90dcfd2d58e76ea7cbb29ee5345f7adbd264c6f5f741c285dd98c43f62358e";
			const expectedPublickey =
				"0x02b9c6c70ef6fd3cd22925de22eb8a76db882af0754b8dc57eafaf6fa40dbb4abd";
			expect(initData.chainCode).toEqual(expectedChainCode);
			expect(initData.publicKey).toEqual(expectedPublickey);
		});
	});

	describe("getSignedTx", () => {
		it("Should get the signed tx succesfully", async () => {
			const chainCode =
				"0x9c90dcfd2d58e76ea7cbb29ee5345f7adbd264c6f5f741c285dd98c43f62358e";
			const publicKey =
				"0x02b9c6c70ef6fd3cd22925de22eb8a76db882af0754b8dc57eafaf6fa40dbb4abd";
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
			};

			const forwardingParams = {
				nonce: 0n,
				gasPrice: 200000n,
				gasLimit: 50000n,
			};

			const tee = new Tee(publicKey, chainCode);
			const result = (await tee.getSignedTx({
				protocol: ProtocolCode.EVM,
				commitment: commitmentParams,
				forwarding: forwardingParams,
			})) as TransactionSerialized;

			const signedTx = parseTransaction(result);

			const expectedAddress = "0x4127786eF2AcF3f46f0A14805Bd875fA43494E5f";
			const signer = await recoverTransactionAddress({
				serializedTransaction: result,
			});
			expect(signer).toEqual(expectedAddress);
			expect(signedTx.data).toEqual(calldata);
			expect(signedTx.chainId).toEqual(chainId);
			expect(signedTx.gas).toEqual(forwardingParams.gasLimit);
			expect(signedTx.gasPrice).toEqual(forwardingParams.gasPrice);
			expect(signedTx.nonce).toEqual(Number(forwardingParams.nonce));
		});
	});

	describe("generateDPSEvmAddress()", () => {
		it("Should generate the expected address", async () => {
			const publicKey =
				"0x039400c7dc419576781027d5aeddebaee22088172b18b76f2c3e53ca1765e19c4b";
			const chainCode =
				"0x1e3f0f00431911762a5e0dd43d928265c77fec6e4d49f18232d9e57ab13fd91a";
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
			};

			const tee = new Tee(publicKey, chainCode);
			const result = tee.generateDPSEvmAddress(commitmentParams);

			expect(result).toEqual(expectedAddress);
		});
	});
});

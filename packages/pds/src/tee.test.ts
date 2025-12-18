import { describe, expect, it } from "vitest";
import {
	parseTransaction,
	recoverTransactionAddress,
	type Hex,
	type TransactionSerialized,
} from "viem";
import { Tee } from "./tee";
import { ProtocolCode } from "./data/tee-message";
import {
	EvmCommitmentParameters,
	EvmForwardingParameters,
	type EvmPermittedOps,
} from "./data/evm-params";

function getForwardingParams(
	commitmentParams: EvmCommitmentParameters,
	params: Partial<EvmForwardingParameters>,
): EvmForwardingParameters {
	const calldata =
		params.calldata ||
		"0xa9059cbb0000000000000000000000002cff890f0378a11913b6129b2e97417a2c302680000000000000000000000000000000000000000000000000000000000004ab52";
	const contract =
		params.contract || "0xdac17f958d2ee523a2206206994597c13d831ec7";
	const value = params.value ?? 0n;
	const nonce = params.nonce ?? 0n;
	const gasPrice = params.gasPrice ?? 200000n;
	const gasLimit = params.gasLimit ?? 50000n;
	const chainId = params.chainId ?? 1n;

	return new EvmForwardingParameters(
		commitmentParams,
		calldata,
		contract,
		value,
		nonce,
		gasPrice,
		gasLimit,
		chainId,
	);
}

describe("TEE abstraction tests", () => {
	const chainCode =
		"0x9c90dcfd2d58e76ea7cbb29ee5345f7adbd264c6f5f741c285dd98c43f62358e";
	const publickey =
		"0x02b9c6c70ef6fd3cd22925de22eb8a76db882af0754b8dc57eafaf6fa40dbb4abd";

	const extraData = "account.near";
	const refundTo = "0xCEf67989ae740cC9c92fa7385F003F84EAAFd915";
	const permittedOps = [
		{
			calldataRegex:
				"0xa9059cbb0000000000000000000000002cff890f0378a11913b6129b2e97417a2c302680[0-9a-fA-F]{64}",
			contract: "0xdac17f958d2ee523a2206206994597c13d831ec7" as Hex,
		},
	];

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

	describe("generateEvmAddress()", () => {
		it("Should generate the expected address", async () => {
			const commitmentParams = new EvmCommitmentParameters(
				extraData,
				refundTo,
				permittedOps,
			);

			const tee = new Tee(publickey, chainCode);
			const result = tee.getAddress(commitmentParams);

			const expectedAddress = "0x9C616D0d0aF5D807FfB7B5d5e37e9a91f2AFD657";
			expect(result).toEqual(expectedAddress);
		});
	});

	describe("getSignedTx", () => {
		it("Should get the signed tx succesfully", async () => {
			const commitmentParams: EvmCommitmentParameters =
				new EvmCommitmentParameters(extraData, refundTo, permittedOps);

			const forwardingParams = getForwardingParams(commitmentParams, {});

			const tee = new Tee(publickey, chainCode);
			const result = (await tee.getSignedTx(
				ProtocolCode.EVM,
				forwardingParams,
			)) as TransactionSerialized;

			const signedTx = parseTransaction(result);

			const expectedAddress = tee.getAddress(commitmentParams);
			const signer = await recoverTransactionAddress({
				serializedTransaction: result,
			});
			expect(signer).toEqual(expectedAddress);
			expect(signedTx.data).toEqual(forwardingParams.calldata);
			expect(signedTx.chainId).toEqual(Number(forwardingParams.chainId));
			expect(signedTx.gas).toEqual(forwardingParams.gasLimit);
			expect(signedTx.gasPrice).toEqual(forwardingParams.gasPrice);
			expect(signedTx.nonce).toEqual(Number(forwardingParams.nonce));
		});

		it("Should fail", async () => {
			const commitmentParams = new EvmCommitmentParameters(extraData, refundTo, permittedOps);
			const calldata = "0xa9059cbb000000000000000000000000fcdefbfc00f19427862160947486f33fcb519f6f000000000000000000000000000000000000000000000000000000000000014d";
			const fp = getForwardingParams(commitmentParams, { calldata });
			const tee = new Tee(publickey, chainCode);

			await expect(tee.getSignedTx(
				ProtocolCode.EVM,
				fp,
			)).rejects.toThrowError("calldata not allowed");
		})

		it("Should not fail when the transfer amount is different", async () => {
			const tee = new Tee(publickey, chainCode);
			const ops: EvmPermittedOps[] = [
				{
					contract: permittedOps[0]!.contract,
					calldataRegex:
						"0xa9059cbb0000000000000000000000002cff890f0378a11913b6129b2e97417a2c302680[a-fA-F0-9]{64}",
				},
			];
			const commitmentParams: EvmCommitmentParameters =
				new EvmCommitmentParameters(extraData, refundTo, ops);

			const fp = getForwardingParams(commitmentParams, {
				calldata:
					"0xa9059cbb0000000000000000000000002cff890f0378a11913b6129b2e97417a2c302680000000000000000000000000000000000000000000000000000000000001ab52",
			});

			await expect(tee.getSignedTx(ProtocolCode.EVM, fp)).resolves;
		});

		it("Should fail when calldata does not match the committed regex", async () => {
			const tee = new Tee(publickey, chainCode);
			const commitmentParams: EvmCommitmentParameters =
				new EvmCommitmentParameters(extraData, refundTo, permittedOps);

			// Case 1: first byte is change
			const forwardingParamsArray: Array<EvmForwardingParameters> = [];

			forwardingParamsArray.push(
				getForwardingParams(commitmentParams, {
					calldata:
						"0xb9059cbb0000000000000000000000002cff890f0378a11913b6129b2e97417a2c302680000000000000000000000000000000000000000000000000000000000004ab52",
				}),
			);

			// Case 2: recipient change
			forwardingParamsArray.push(
				getForwardingParams(commitmentParams, {
					calldata:
						"0xa9059cbb000000000000000000000000CEf67989ae740cC9c92fa7385F003F84EAAFd9150000000000000000000000000000000000000000000000000000000000004ab52",
				}),
			);

			for (const fp of forwardingParamsArray) {
				await expect(
					tee.getSignedTx(ProtocolCode.EVM, fp),
				).rejects.toThrowError("calldata not allowed");
			}
		});

		it("Should fail when called contract does not match the committed one", async () => {
			const commitmentParams: EvmCommitmentParameters =
				new EvmCommitmentParameters(extraData, refundTo, permittedOps);

			const forwardingParams = getForwardingParams(commitmentParams, {
				contract: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",
			});

			const tee = new Tee(publickey, chainCode);

			await expect(
				tee.getSignedTx(ProtocolCode.EVM, forwardingParams),
			).rejects.toThrowError("input contract not allowed");
		});
	});
});

import * as secp from "@noble/secp256k1";
import {
	hexToBytes,
	sha256,
	toBytes,
	toHex,
	type Address,
	type Hex,
} from "viem";
import { HDKey, publicKeyToAddress } from "viem/accounts";
import { encode, decode } from "cbor2";
import { hexToBip32Path } from "../bip32-ext";

export type EvmPermittedOps = {
	calldataRegex: string;
	contracts: Address[];
};

export interface ForwardingParameters {
	commitmentParams: CommitmentParameters;
	payload(): Hex;
}

export interface CommitmentParameters {
	bytes(): Uint8Array;
	hex(): Hex;
	hash(): Hex;
	address(publicKey: Hex, chainCode: Hex): Address;
}

export class EvmCommitmentParameters implements CommitmentParameters {
	readonly extraData: string;
	readonly refundTo: Address;
	readonly permittedOps: EvmPermittedOps[];

	constructor(
		extraData: string,
		refundTo: Address,
		permittedOps: EvmPermittedOps[],
	) {
		this.extraData = extraData;
		this.refundTo = refundTo.toLowerCase() as Hex;
		const byAlphaNumericOrder = (a: EvmPermittedOps, b: EvmPermittedOps) =>
			a.calldataRegex < b.calldataRegex ? -1 : 1;

		// Sorting to strengthen the deterministic result
		this.permittedOps = permittedOps
			.map(({ contracts, calldataRegex }) => ({
				contracts: contracts.map((c) => c.toLowerCase() as Hex).sort(),
				calldataRegex: calldataRegex.replace("0x", "").toLowerCase(),
			}))
			.sort(byAlphaNumericOrder);
	}

	bytes(): Uint8Array {
		return encode({
			extraData: this.extraData,
			refundTo: this.refundTo,
			permittedOps: this.permittedOps,
		});
	}

	hex(): Hex {
		return toHex(this.bytes());
	}

	hash(): Hex {
		return sha256(this.bytes(), "hex");
	}

	static parse(serialized: Hex): EvmCommitmentParameters {
		const { extraData, refundTo, permittedOps } =
			decode<EvmCommitmentParameters>(toBytes(serialized));

		return new EvmCommitmentParameters(extraData, refundTo, permittedOps);
	}

	address(publicKey: Hex, chainCode: Hex): Address {
		const deterministicPath = hexToBip32Path(this.hash());
		const publicKeyBytes = hexToBytes(publicKey);
		const chainCodeBytes = hexToBytes(chainCode);
		const hd = new HDKey({
			publicKey: publicKeyBytes,
			chainCode: chainCodeBytes,
		});

		const child = hd.derive(`m/${deterministicPath}`);
		const point = secp.Point.fromBytes(child.publicKey as secp.Bytes);

		const uncompressed = false;
		const address = publicKeyToAddress(`0x${point.toHex(uncompressed)}`);

		return address;
	}
}

export class EvmForwardingParameters implements ForwardingParameters {
	readonly commitmentParams: EvmCommitmentParameters;
	readonly calldata: Hex;
	readonly contract: Address;
	readonly value: bigint;
	readonly nonce: bigint;
	readonly gasPrice: bigint;
	readonly gasLimit: bigint;
	readonly chainId: bigint;

	constructor(
		commitmentParams: Hex,
		calldata: Hex,
		contract: Address,
		value: bigint,
		nonce: bigint,
		gasPrice: bigint,
		gasLimit: bigint,
		chainId: bigint,
	) {
		this.calldata = calldata;
		this.contract = contract;
		this.value = value;
		this.commitmentParams = EvmCommitmentParameters.parse(commitmentParams);
		this.nonce = nonce;
		this.gasPrice = gasPrice;
		this.gasLimit = gasLimit;
		this.chainId = chainId;
	}

	payload(): Hex {
		return toHex(
			encode({
				commitment: this.commitmentParams.hex(),
				nonce: this.nonce.toString(),
				value: this.value.toString(),
				calldata: this.calldata.toLowerCase(),
				contract: this.contract.toLowerCase(),
				gasPrice: this.gasPrice ? this.gasPrice.toString() : null,
				gasLimit: this.gasLimit.toString(),
				chainId: this.chainId.toString(),
			}),
		);
	}
}

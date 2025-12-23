import * as secp from "@noble/secp256k1";
import {
	concat,
	hexToBytes,
	sha256,
	stringToBytes,
	toHex,
	type Address,
	type ByteArray,
	type Hex,
} from "viem";
import { HDKey, publicKeyToAddress } from "viem/accounts";
import { encode, decode } from "cbor2";
import { hexToBip32Path } from "../bip32-ext";

export type EvmPermittedOps = {
	calldataRegex: string;
	contract: Address;
};

export interface ForwardingParameters {
	commitmentParams: CommitmentParameters;
	payload(): Hex;
}

export interface CommitmentParameters {
	bytes(): Uint8Array;
	hex(): Hex;
	hash(): Hex;
	parse(serialized: Hex): CommitmentParameters;
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
		this.permittedOps = permittedOps.map(({ contract, calldataRegex }) => ({
			contract: contract.toLowerCase() as Hex,
			calldataRegex: calldataRegex.replace("0x", "").toLowerCase(),
		}));
	}

	bytes(): Uint8Array {
		const permittedOpsBytes = this.permittedOps.reduce((acc, elem) => {
			return concat([
				acc,
				stringToBytes(elem.calldataRegex),
				hexToBytes(elem.contract),
			]);
		}, new Uint8Array([]) as ByteArray);

		return concat([
			stringToBytes(this.extraData),
			hexToBytes(this.refundTo),
			permittedOpsBytes,
		]);
	}

	hex(): Hex {
		return toHex(this.bytes());
	}

	hash(): Hex {
		return sha256(this.bytes(), "hex");
	}

	parse(serialized: Hex): EvmCommitmentParameters {
		const { extraData, refundTo, permittedOps } =
			decode<EvmCommitmentParameters>(serialized);

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
		commitmentParams: EvmCommitmentParameters,
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
		this.commitmentParams = commitmentParams;
		this.nonce = nonce;
		this.gasPrice = gasPrice;
		this.gasLimit = gasLimit;
		this.chainId = chainId;
	}

	payload(): Hex {
		return toHex(
			encode({
				extraData: this.commitmentParams.extraData,
				refundTo: this.commitmentParams.refundTo,
				permittedOps: this.commitmentParams.permittedOps,
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

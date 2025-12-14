import * as cbor from "cbor";
import * as secp from "@noble/secp256k1";
import { HDKey, publicKeyToAddress } from "viem/accounts";
import {
	concat,
	concatHex,
	hexToBytes,
	slice,
	toHex,
	type Address,
	type Hex,
} from "viem";
import { getEvmCommitmentHash } from "./commitments";
import { hexToBip32Path } from "./bip32-ext";
import type { EvmCommitmentParameters, EvmForwardingParameters } from "./types";
import { Outlayer } from "./outlayer";

export enum ProtocolCode {
	EVM = "0x00000001",
}

export enum CommandCode {
	INIT = "0x00000000",
	SIGN = "0x00000001",
}

export type TeeMessage = {
	version: Hex;
	protocol: ProtocolCode;
	command: CommandCode;
	payload: Hex;
};

export type TeeResult = {
	result: Hex;
};

export type TeeInitParameters = {
	protocol: ProtocolCode;
	payload?: Hex;
};

export type TeeInitData = {
	publicKey: Hex;
	chainCode: Hex;
};

export type TeeGetSignedTxParameters = {
	protocol: ProtocolCode;
	commitment: EvmCommitmentParameters; // | SolCommitmentParameters | ...
	forwarding: EvmForwardingParameters; // | SolForwadingParameters | ...
};

export class Tee {
	readonly VERSION: Hex = "0x01";

	readonly publicKey: Hex | null;
	readonly chainCode: Hex | null;

	// Null values are allowed when TEE is not initialized
	constructor(publicKey: Hex | null = null, chainCode: Hex | null = null) {
		this.publicKey = publicKey;
		this.chainCode = chainCode;
	}

	async initialize(params: TeeInitParameters): Promise<TeeInitData> {
		const outlayer = new Outlayer();
		const message = this.encodeMessage({
			version: this.VERSION,
			protocol: params.protocol,
			command: CommandCode.INIT,
			payload: params.payload || "0x",
		});

		const result = await outlayer.send({ message });

		if (!result) {
			throw new Error("Failed to retrieve signed transaction");
		}

		// Remove header
		const payload = slice(result, 9);

		return {
			publicKey: slice(payload, 0, 33),
			chainCode: slice(payload, 33),
		} as TeeInitData;
	}

	async getSignedTx(params: TeeGetSignedTxParameters): Promise<Hex> {
		let payload = null;
		switch (params.protocol) {
			case ProtocolCode.EVM:
				payload = this.getEvmPayload(params.commitment, params.forwarding);
				break;
			default:
				throw new Error(`Unsupported protocol: ${params.protocol}`);
		}

		const message = this.encodeMessage({
			version: this.VERSION,
			protocol: ProtocolCode.EVM,
			command: CommandCode.SIGN,
			payload,
		});

		const outlayer = new Outlayer();
		const result = await outlayer.send({ message });

		if (!result) {
			throw new Error("Failed to retrieve signed transaction");
		}

		// Remove header
		return slice(result, 9);
	}

	generateDPSEvmAddress(commitmentParams: EvmCommitmentParameters): Address {
		if (!this.publicKey || !this.chainCode) {
			throw new Error("Please provide valid public key and chaincode");
		}
		const commitmentHashHex = getEvmCommitmentHash(commitmentParams);
		const deterministicPath = hexToBip32Path(commitmentHashHex);
		const publicKeyBytes = hexToBytes(this.publicKey);
		const chainCodeBytes = hexToBytes(this.chainCode);
		const hd = new HDKey({
			publicKey: publicKeyBytes,
			chainCode: chainCodeBytes,
		});

		const child = hd.derive(`m/${deterministicPath}`);
		const point = secp.Point.fromBytes(child.publicKey as secp.Bytes);
		const uncompressed = concat(["0x04", toHex(point.x), toHex(point.y)]);
		const address = publicKeyToAddress(uncompressed);

		return address;
	}

	getEvmPayload(cp: EvmCommitmentParameters, fp: EvmForwardingParameters): Hex {
		const strings: Array<string> = [];

		// Enforcing order here
		const commitmentValues = [cp.chainId, cp.token, cp.value, cp.calldata];
		commitmentValues.map((value) =>
			strings.push(value.toString().toLowerCase()),
		);
		const forwardingValues = [fp.nonce, fp.gasPrice, fp.gasLimit];
		forwardingValues.map((value) =>
			strings.push(value.toString().toLowerCase()),
		);

		return toHex(cbor.encode(strings));
	}

	encodeMessage({ version, protocol, command, payload }: TeeMessage): Hex {
		return concatHex([version, protocol, command, payload]);
	}
}

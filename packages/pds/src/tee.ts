import { slice, type Address, type Hex } from "viem";
import type {
	CommitmentParameters,
	ForwardingParameters,
} from "./data/evm-params";
import { Outlayer } from "./outlayer";
import { CommandCode, type ProtocolCode, TeeMessage } from "./data/tee-message";

export type TeeResult = {
	result: Hex;
	error: string;
};

export type TeeInitParameters = {
	protocol: ProtocolCode;
	payload?: Hex;
};

export type TeeInitData = {
	publicKey: Hex;
	chainCode: Hex;
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
		const message = new TeeMessage({
			version: this.VERSION,
			protocol: params.protocol,
			command: CommandCode.INIT,
			payload: params.payload || "0x",
		});

		const result = await outlayer.send({ message: message.encode() });

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

	async getSignedTx(
		protocol: ProtocolCode,
		forwardingParams: ForwardingParameters,
	): Promise<Hex> {
		const message = new TeeMessage({
			version: this.VERSION,
			protocol,
			command: CommandCode.SIGN,
			payload: forwardingParams.payload(),
		});

		const outlayer = new Outlayer();
		const result = await outlayer.send({ message: message.encode() });

		if (!result) {
			throw new Error("Failed to retrieve signed transaction");
		}

		// Remove header
		return slice(result, 9);
	}

	getAddress(params: CommitmentParameters): Address {
		if (!this.publicKey || !this.chainCode) {
			throw new Error("Please provide valid public key and chaincode");
		}

		return params.address(this.publicKey, this.chainCode);
	}
}

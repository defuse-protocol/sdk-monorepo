import { concatHex, type Hex } from "viem";

export enum ProtocolCode {
	EVM = "0x00000001",
}

export enum CommandCode {
	INIT = "0x00000000",
	SIGN = "0x00000001",
}

export class TeeMessage {
	readonly version: Hex;
	readonly protocol: ProtocolCode;
	readonly command: CommandCode;
	readonly payload: Hex;

	constructor({
		version,
		protocol,
		command,
		payload,
	}: {
		version: Hex;
		protocol: ProtocolCode;
		command: CommandCode;
		payload: Hex;
	}) {
		this.version = version;
		this.protocol = protocol;
		this.command = command;
		this.payload = payload;
	}

	encode() {
		return concatHex([this.version, this.protocol, this.command, this.payload]);
	}
}

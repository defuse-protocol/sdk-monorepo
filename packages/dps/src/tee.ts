import * as cbor from "cbor";
import * as secp from "@noble/secp256k1";
import { HDKey, publicKeyToAddress } from 'viem/accounts';
import { concat, concatHex, hexToBytes, toHex, type Address, type ByteArray, type Hex } from "viem";
import { getEvmCommitmentHash, getSerializedArray } from "./commitments";
import { hexToBip32Path } from "./bip32-ext";
import type { EvmCommitmentParameters, EvmForwardingParameters } from "./types";
import { Outlayer } from "./outlayer";


// TODO: remove
const PROTECTED_SEED = 'f909b4aa7bdcb86e5d087f64ac3c448b29faf79009861fe8fbfde5a2ddf03653ed93f9ef27f7b74780aa48f042e44c0f7e29be6e043522abe684ef0112ae2c77';

export enum ProtocolCode {
    EVM = '0x00000001',
}

export enum CommandCode {
    SIGN = '0x00000001'
}

export type TeeMessage = { 
    version: Hex
    protocol: ProtocolCode,
    command: CommandCode,
    payload : Hex
}

export type TeeResult = {
    result: Hex,
}

export class Tee {
    readonly VERSION: Hex = '0x01';

    readonly publicKey: Hex;
    readonly chainCode: Hex;
    
    constructor(publicKey: Hex, chainCode: Hex) {
        this.publicKey = publicKey;
        this.chainCode = chainCode;
    }

    generateDPSEvmAddress(
        commitmentParams: EvmCommitmentParameters,
    ): Address {
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

        Object.values(cp).map(value => strings.push(value.toString().toLowerCase()))
        Object.values(fp).map(value => strings.push(value.toString().toLowerCase()))

        return toHex(cbor.encode(strings));
    }

    encodeMessage({ version, protocol, command, payload }: TeeMessage): Hex {
        return concatHex([ version, protocol, command, payload ]);
    }

    async getEvmSignedTx(commitmentParams: EvmCommitmentParameters, forwardingParams: EvmForwardingParameters): Promise<Hex | null> {
        const payload = this.getEvmPayload(commitmentParams, forwardingParams);
        const message = this.encodeMessage({ 
            version: this.VERSION, 
            protocol: ProtocolCode.EVM, 
            command: CommandCode.SIGN, 
            payload 
        })

        try {
            const outlayer = new Outlayer(PROTECTED_SEED);
            return outlayer.send(message);
            
        } catch (error) {
            console.error("Transaction failed:", error)
        }

        return null;
    }
}
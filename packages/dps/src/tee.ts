import * as secp from "@noble/secp256k1";
import { HDKey, publicKeyToAddress } from 'viem/accounts';
import { concat, hexToBytes, toHex, type Address, type Hex } from "viem";
import { getCommitmentHash } from "./commitments";
import { hexToBip32Path } from "./bip32-ext";
import type { EvmCommitmentParameters } from "./types";

export class Tee {
    readonly publicKey: Hex;
    readonly chainCode: Hex;
    
    constructor(publicKey: Hex, chainCode: Hex) {
        this.publicKey = publicKey;
        this.chainCode = chainCode;
    }

    generateDPSEvmAddress(
        commitmentParams: EvmCommitmentParameters,
    ): Address {
        const commitmentHashHex = getCommitmentHash(commitmentParams);
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
}
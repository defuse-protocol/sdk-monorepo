import type { Hex } from "viem";

export interface TeeProvider {
	url: string;
	send(message: string): Promise<Hex>;
}

import evmSlugRegistry from "./evm-slug-registry.json" with { type: "json" };
import { stringify1cs } from "./stringify";
import type { OneCsAsset } from "./types";

// minimal Uniswap token shape
export interface UniToken {
	chainId: number;
	address: string;
}

export function fromUniswapToken(
	token: UniToken,
	slugMap?: Record<number, string>,
): string {
	const chain =
		slugMap?.[token.chainId] ??
		(evmSlugRegistry as Record<number, string>)[token.chainId];
	if (chain == null) {
		throw new Error(`Unsupported chainId = ${token.chainId}`);
	}
	const o: OneCsAsset = {
		version: "v1",
		chain,
		namespace: "erc20",
		reference: token.address,
	};
	return stringify1cs(o);
}

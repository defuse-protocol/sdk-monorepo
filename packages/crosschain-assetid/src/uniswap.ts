import evmSlugRegistry_ from "./caip2-slug-registry.json" with { type: "json" };
import { stringify1cs } from "./stringify";
import type { OneCsAsset } from "./types";

// minimal Uniswap token shape
export interface UniToken {
	chainId: number;
	address: string;
}

// for type safety
const evmSlugRegistry: Record<string, string> = evmSlugRegistry_;

export function fromUniswapToken<T extends UniToken>(
	token: T,
	caip2slugMap?: Record<string, string>,
): string {
	const caip2 = `eip155:${token.chainId}`;
	const chain = caip2slugMap?.[caip2] ?? evmSlugRegistry[caip2];
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

import { expect, it } from "vitest";
import { fromUniswapToken } from "./uniswap";

it("converts to 1cs asset id string", () => {
	const result = fromUniswapToken({
		address: "0x177127622c4a00f3d409b75571e12cb3c8973d3c",
		chainId: 100,
		decimals: 18,
		symbol: "COW",
		name: "CoW Protocol Token from Mainnet",
		logoURI:
			"https://tokens-data.1inch.io/images/100/0x177127622c4a00f3d409b75571e12cb3c8973d3c.png",
	});

	expect(result).toEqual(
		"1cs_v1:gnosis:erc20:0x177127622c4a00f3d409b75571e12cb3c8973d3c",
	);
});

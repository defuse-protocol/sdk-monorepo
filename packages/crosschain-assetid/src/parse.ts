import type { OneCs } from "./types";

export function parse1cs(s: string): OneCs {
	const parts = s.split(":");
	if (parts.length < 4 || parts.length > 5 || parts[0] !== "1cs_v1") {
		throw new Error("Invalid 1cs_v1 string");
	}
	const [_, chain, namespace, refEnc, selEnc] = parts;
	const obj: OneCs = {
		version: "v1",
		// biome-ignore lint/style/noNonNullAssertion: existence checked above
		chain: chain!,
		// biome-ignore lint/style/noNonNullAssertion: existence checked above
		namespace: namespace!,
		// biome-ignore lint/style/noNonNullAssertion: existence checked above
		reference: decodeURIComponent(refEnc!),
	};
	if (selEnc !== undefined) obj.selector = decodeURIComponent(selEnc);
	return obj;
}

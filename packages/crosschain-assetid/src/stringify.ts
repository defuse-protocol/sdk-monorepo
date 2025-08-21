import type { OneCsAsset } from "./types";

export function stringify1cs(o: OneCsAsset): string {
	const ref = encodeURIComponent(o.reference);
	const sel = o.selector != null ? `:${encodeURIComponent(o.selector)}` : "";
	return `1cs_v1:${o.chain}:${o.namespace}:${ref}${sel}`;
}

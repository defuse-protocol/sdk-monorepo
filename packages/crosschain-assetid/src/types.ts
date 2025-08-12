export interface OneCs {
	version: "v1";
	chain: string; // 'sol'
	namespace: string; // 'spl' | 'spl2022'
	reference: string; // mint (RAW, decoded)
	selector?: string; // never for SPL fungible tokens
}

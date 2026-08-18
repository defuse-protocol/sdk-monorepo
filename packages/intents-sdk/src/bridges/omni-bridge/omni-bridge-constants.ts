export const NEAR_NATIVE_ASSET_ID = "nep141:wrap.near";
export const OMNI_BRIDGE_CONTRACT = "omni.bridge.near";
export const MIN_STORAGE_BALANCE_FOR_INTENTS_NEAR = 500000000000000000000000n; // 0.5 NEAR

export const SOL_OMNI_CONTRACT_ID = "sol.omft.near";
// This value is not dynamic and can be hardcoded to avoid extra network request
export const MIN_AMOUNT_SOL_OMNI_WITHDRAWAL = 890880n;
// This was chosen empirically and may not be optimal, it includes 10% margin.
export const MIN_GAS_AMOUNT = "37400000000000"; // 37.4 tgas
export const INTENTS_STORAGE_BALANCE_CACHE_KEY = "INTENTS_STORAGE_BALANCE";

// API returns non-zero fee for them; however, these tokens have own relayers that bridge them for free.
export const FEE_SUBSIDIZED_TOKENS = ["nep141:lsd-usdt.rhealab.near"];

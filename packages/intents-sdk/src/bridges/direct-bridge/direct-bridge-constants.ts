export const NEAR_NATIVE_ASSET_ID = "nep141:wrap.near";

// This was chosen empirically and may not be optimal, it includes 10% margin.
// Only used when `msg` is not provided (simple ft_transfer, not ft_transfer_call).
export const MIN_GAS_AMOUNT = "17050000000000"; // 17.05 tgas

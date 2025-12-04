export const NEAR_NATIVE_ASSET_ID = "nep141:wrap.near";

/**
 * This was chosen empirically and may not be optimal, it includes a tiny margin.
 *
 * NOT USED: Other virtual chains with non-ETH base tokens may require more gas.
 *
 * TODO: Estimate gas for other virtual chains and set in `ft_withdraw`.
 */
export const MIN_GAS_AMOUNT = "35000000000000"; // 35 tgas

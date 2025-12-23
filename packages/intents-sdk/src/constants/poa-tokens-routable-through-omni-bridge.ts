/**
 * Checks if a PoA token contract ID is eligible for routing through Omni Bridge.
 *
 * These token contract IDs can be routed through either PoA Bridge or Omni Bridge
 * depending on the SDK configuration. Use the `routeMigratedPoaTokensThroughOmniBridge`
 * feature flag to enable Omni Bridge routing for these tokens.
 *
 * @param nearAddress - The NEAR token contract ID to check (e.g., "sol.omft.near")
 * @returns True if the token contract ID is eligible for Omni Bridge routing
 */
export const POA_TOKENS_ROUTABLE_THROUGH_OMNI_BRIDGE = ["sol.omft.near"];

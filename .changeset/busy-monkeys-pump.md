---
"@defuse-protocol/intents-sdk": minor
---

Reworked prefunded withdrawal fees configuration. When fees are prefunded, the account already holds the fee asset (e.g. NEAR, or the destination chain's native token for HOT Bridge), so the SDK skips quoting withdrawal fees.
  - `bridgeConfigs` now supports `RouteEnum.HotBridge`, `RouteEnum.OmniBridge`, `RouteEnum.NearWithdrawal` and `RouteEnum.VirtualChain`.
  - Added `bridgeConfigs[route].feesPrefunded` — prefunds fees for all tokens on the route, overriding `prefundedFeesTokens`.

**BREAKING CHANGES:** Renamed `bridgeConfigs[route].prefundedNativeFeeTokens` to `bridgeConfigs[route].prefundedFeesTokens`.

---
"@defuse-protocol/intents-sdk": minor
---

Added `features.feesPrefunded` SDK option — skips quoting withdrawal fees when the account already holds the asset needed to cover them (e.g. NEAR), or when quoting is not possible.

**BREAKING CHANGES:** Removed the `bridgeConfigs` SDK option (and the `BridgeConfigs` type), including Omni Bridge's `prefundedNativeFeeTokens`. Use `features: { feesPrefunded: true }` instead.

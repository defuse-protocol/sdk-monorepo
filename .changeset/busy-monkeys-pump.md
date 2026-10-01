---
"@defuse-protocol/intents-sdk": minor
---

Added the `features.feesPrefunded` SDK option, which skips quoting withdrawal fees. Use it when the account already holds the asset needed to cover them (e.g. NEAR, or the destination chain's native token for HOT Bridge).

**BREAKING CHANGES:** Removed the `bridgeConfigs` SDK option (and the `BridgeConfigs` type), including Omni Bridge's `prefundedNativeFeeTokens`. Use `features: { feesPrefunded: true }` instead.

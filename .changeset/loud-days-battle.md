---
"@defuse-protocol/intents-sdk": minor
---

Support prefunded tokens for Omni Bridge via Bridge Config, also delete zero token fee configuration for PoA Bridge.

- Added `bridgeConfigs[RouteEnum.OmniBridge].prefundedNativeFeeTokens` — asset IDs whose withdrawal native fee is prefunded.
- Removed `bridgeConfigs[RouteEnum.PoaBridge].zeroFeeTokens` — the PoA Bridge zero-fee token configuration is no longer supported.

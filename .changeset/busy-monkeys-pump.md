---
"@defuse-protocol/intents-sdk": minor
---

Adds ability to skip quoting of fees in bridges and remove omni bridge prefunded tokens configuration
  - Added `quoteOptions.skip` — optional field to skip quoting fees (useful if quoting is impossible or asset being quoted is already on address balance).
  - Removed `bridgeConfigs[RouteEnum.OmniBridge].prefundedNativeFeeTokens` — asset IDs whose withdrawal native fee is prefunded, `quoteOptions.skip` should be used for them.

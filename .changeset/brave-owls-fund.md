---
"@defuse-protocol/crosschain-assetid": minor
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Support prefunded tokens for Near Withdrawal via Bridge Config, also change Quantus CAIP-2 identifier.
  - Added `bridgeConfigs[RouteEnum.NearWithdrawal].prefundedNativeFeeTokens` — asset IDs whose withdrawal storage deposit fee is prefunded.
  - Changed Quantus CAIP-2 identifier from `quantus:mainnet` to `qtc:mainnet`.

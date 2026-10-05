---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Support prefunded tokens for Near Withdrawal via Bridge Config, also change Quantus PoA network reference.
  - Added `bridgeConfigs[RouteEnum.NearWithdrawal].prefundedNativeFeeTokens` — asset IDs whose withdrawal storage deposit fee is prefunded.
  - Changed Quantus PoA network reference from `quantus:mainnet` to `qtc:mainnet`. CAIP-2 identifier (`Chains.Qtc`) remains `quantus:mainnet`.

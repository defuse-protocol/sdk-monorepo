---
"@defuse-protocol/intents-sdk": minor
---

Add the entry point `@defuse-protocol/intents-sdk/omni-bridge` with
`deriveOmniWithdrawIntentParams`, which computes the values of an Omni withdrawal without
building the intents, plus `caip2ToChainKind` and `isUtxoChain` to build its chain argument.

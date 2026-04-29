---
"@defuse-protocol/intents-sdk": minor
---

Add Fogo support to the intents SDK: exposes the `Chains.Fogo` CAIP2 constant, validates Fogo addresses (Solana-format), and wires Fogo through the POA Bridge so withdrawals to native FOGO and SPL tokens (e.g. iFOGO) on Fogo are routed correctly.
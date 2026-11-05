---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Add Stellar and TON support via PoA

- **TON:** raw addresses (`0:<hex>`) are no longer accepted, because PoA uses `:` as a delimiter and they break withdrawals. Use the friendly format (`EQ…` / `UQ…`) instead.
- **Stellar:** address validation now decodes the address and verifies its checksum.
- **Stellar:** withdrawing a non-native asset to an account that isn't funded yet throws `StellarAccountNotFoundError`, which is now exported so it can be caught. Native XLM withdrawals skip the check, since they fund the account themselves.

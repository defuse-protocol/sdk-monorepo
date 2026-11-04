---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Add Stellar and TON support via PoA

- **TON:** raw addresses (`0:<hex>`) are no longer accepted, because PoA uses `:` as a delimiter and they break withdrawals. Use the friendly format (`EQ…` / `UQ…`) instead.
- **Stellar:** address validation now decodes the address and verifies its checksum.

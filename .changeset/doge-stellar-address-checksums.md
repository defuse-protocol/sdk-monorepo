---
"@defuse-protocol/intents-sdk": patch
---

Improve Dogecoin and Stellar address validation by adding checksum validation. Dogecoin addresses are checked with Base58Check (P2PKH `D...`, P2SH `A...` or `9...`), so valid P2SH addresses that start with `9` are now accepted. Stellar account IDs (`G...`) are checked against the SEP-23 StrKey version byte and CRC16.

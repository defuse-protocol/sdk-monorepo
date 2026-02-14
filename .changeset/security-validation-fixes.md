---
"@defuse-protocol/intents-sdk": patch
---

fix: security improvements for address validation, fee precision, and timestamp handling

### Bitcoin Address Validation (BTC-001)
- Added Base58Check checksum verification for P2PKH and P2SH addresses
- Added proper Bech32/Bech32m validation for SegWit and Taproot addresses
- Prevents funds being sent to addresses with typos or transcription errors

### Fee Estimation Precision (FEE-001)
- Increased USD_SCALE from 1e6 to 1e12 for better precision with low-value tokens
- Added MIN_SCALED_PRICE floor to prevent division by zero
- Tokens priced as low as $0.000000000001 are now handled correctly

### TON Timestamp Precision (TON-001)
- Added bigintToBigEndian function for handling timestamps > 32 bits
- Updated computeTonConnectHash to use BigInt for timestamp serialization
- Prevents hash computation errors for far-future timestamps

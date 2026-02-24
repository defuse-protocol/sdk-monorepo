---
"@defuse-protocol/internal-utils": patch
---

fix(internal-utils): left-pad P256 signature r,s to 32 bytes

DER encoding represents integers in minimal form, stripping leading zero bytes.
When r or s < 2^248 (~0.4% chance per component), the decoded value is 31 bytes
instead of 32, producing a 63-byte signature that the on-chain deserializer rejects.

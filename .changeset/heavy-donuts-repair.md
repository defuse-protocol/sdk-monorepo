---
"@defuse-protocol/internal-utils": patch
---

Parse P-256 WebAuthn signatures with `@noble/curves` instead of `@peculiar/asn1-ecc`/`@peculiar/asn1-schema`, and drop both dependencies.

`@peculiar/asn1-schema` keeps decorator-registered schema metadata in a module-singleton registry. When a dependency tree contains two copies of the package, `AsnParser.parse` reads from a different registry than the one `ECDSASigValue` registered in, silently returning empty `r`/`s` — the extracted signature collapses to zero bytes and every ES256 passkey signature fails downstream. `p256.Signature.fromDER(...).normalizeS().toCompactRawBytes()` is behavior-equivalent (DER sign-byte stripping, 32-byte left-padding, low-S normalization) with no global state.

Note: `fromDER` is strict about canonical DER, which spec-compliant authenticators always emit; malformed input now throws instead of being parsed leniently. The unexported-from-index `normalizeSignatureS` helper was removed along with the hand-rolled padding helpers.

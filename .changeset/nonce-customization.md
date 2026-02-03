---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Add nonce customization and static salt support for private blockchains.

- `VersionedNonceBuilder.createTimestampedNonceBytes(startTime)` — embed start timestamp in nonce
- `EnvConfig.contractSalt` — static salt (hex) for private blockchains
- `IntentPayloadBuilder.setNonceRandomBytes(bytes)` — custom random bytes for nonce generation
- **Breaking:** nonce deadline now equals intent deadline (removed 5s offset)

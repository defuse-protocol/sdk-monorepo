---
"@defuse-protocol/intents-sdk": minor
"@defuse-protocol/internal-utils": minor
---

feat: allow custom EnvConfig via SDK constructor

SDK now accepts custom `EnvConfig` objects for private environments:

```typescript
new IntentsSDK({
  env: {
    contractID: "intents.private-shard",
    solverRelayBaseURL: "https://private-relay.example.com",
    // ... other URLs
  },
  referral: "...",
});
```

Empty string in config means service unavailable (throws at use time).

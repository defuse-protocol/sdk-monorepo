---
"@defuse-protocol/bridge-sdk": patch
---

Automatically append withdrawal intents. Example:

```typescript
// Previously
bridgeSDK.createBatchWithdrawals({
    intent: {
        payload: (intentParams) => ({
            intents: [...moreIntents, ...intentParams.intents],
        })
    }
)

// Now
bridgeSDK.createBatchWithdrawals({
    intent: {
        payload: () => ({
            intents: moreIntents,
        })
    }
)
```

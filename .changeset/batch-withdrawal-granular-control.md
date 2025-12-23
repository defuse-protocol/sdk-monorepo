---
"@defuse-protocol/intents-sdk": minor
---

Add `createWithdrawalCompletionPromises()` for granular control over batch withdrawals

**Breaking changes:**

- Remove `retryOptions` parameter from `waitForWithdrawalCompletion()` and `processWithdrawal()`. Waiting now continues indefinitely until completion or signal abort. Use `AbortSignal.timeout()` to set a timeout budget.

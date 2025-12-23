---
"@defuse-protocol/intents-sdk": minor
---

Add `createWithdrawalCompletionPromises()` for granular control over batch withdrawals

**Breaking changes:**

- Remove `retryOptions` parameter from `waitForWithdrawalCompletion()` and `processWithdrawal()`. Waiting continues until completion, failure, or chain-specific p99 timeout (`PollTimeoutError`). Use `AbortSignal.timeout()` to set a shorter timeout.

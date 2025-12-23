---
"@defuse-protocol/intents-sdk": minor
---

Add `createWithdrawalCompletionPromises()` for granular control over batch withdrawals

**New exports:**

- `WithdrawalWatchError` - thrown when status polling fails (timeout or consecutive errors)
- `WithdrawalFailedError` - thrown when the withdrawal fails on the destination chain

**Breaking changes:**

- Remove `retryOptions` parameter from `waitForWithdrawalCompletion()` and `processWithdrawal()`. Waiting continues until completion, failure, or chain-specific p99 timeout. Use `AbortSignal.timeout()` to set a shorter timeout.

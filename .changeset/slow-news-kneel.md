---
"@defuse-protocol/bridge-sdk": minor
---

Remove `BatchWithdrawalImpl` and `SingleWithdrawalImpl`.
Introduce more methods for granular control over the execution, which support single and batch withdrawals.

New intent-specific methods:
- `signAndSendIntent()`
- `waitForIntentSettlement()`
- `getIntentStatus()`

New withdraw-specific methods:
- `signAndSendWithdrawalIntent()`
- `processWithdrawal()` (replacement for deleted classes)

Changed signatures:
- `waitForWithdrawalCompletion()`

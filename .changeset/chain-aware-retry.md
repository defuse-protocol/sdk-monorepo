---
"@defuse-protocol/intents-sdk": minor
"@defuse-protocol/internal-utils": patch
---

Add chain-aware retry options for `waitForWithdrawalCompletion` based on per-chain p99 timing data.

BREAKING CHANGES:
- Removed `HotWithdrawalPendingError` and `HotWithdrawalCancelledError` exports
- Removed `OmniTransferNotFoundError` and `OmniTransferDestinationChainHashNotFoundError` exports

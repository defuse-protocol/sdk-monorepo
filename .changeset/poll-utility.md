---
"@defuse-protocol/internal-utils": minor
---

Add latency-optimized polling for intent settlement

- New `poll()` utility with probability-based intervals that polls aggressively early and backs off for outliers
- `waitForIntentSettlement()` now uses production timing stats (p50=2s, p90=10s, p99=356s)

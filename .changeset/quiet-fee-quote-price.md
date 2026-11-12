---
"@defuse-protocol/intents-sdk": patch
---

Fix the exact-in fee quote fallback throwing `RangeError: Division by zero` for tokens priced below $0.0000005; a token with no usable price now rethrows the original quote error.

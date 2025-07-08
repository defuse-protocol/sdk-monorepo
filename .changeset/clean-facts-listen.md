---
"@defuse-protocol/internal-utils": patch
---

Fix intercepting timeout error. Previously every AbortError were considered as a timeout error.

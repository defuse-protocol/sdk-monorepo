---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

Add support for authenticated RPC URLs.

- URLs with embedded credentials (`http://user:pass@host:3030`) are now automatically parsed and converted to `Authorization: Basic` header
- New `RpcEndpoint` type allows passing either plain URL strings or config objects with custom headers
- New `extractRpcUrls()` and `normalizeRpcEndpoint()` utilities for RPC endpoint handling

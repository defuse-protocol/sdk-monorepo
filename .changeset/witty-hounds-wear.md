---
"@defuse-protocol/internal-utils": patch
"@defuse-protocol/intents-sdk": patch
---

Enhance NEAR address validation with improved support for different account types

- Rename `isLegitAccountId` to `validateNearAddress` for better clarity
- Add specific validation for Ethereum-style implicit accounts (0x prefix, 42 chars)
- Add validation for NEAR deterministic accounts (0s prefix, 42 chars) 
- Improve validation for standard NEAR implicit accounts (64 hex chars)

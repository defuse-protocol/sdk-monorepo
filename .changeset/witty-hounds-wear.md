---
"@defuse-protocol/internal-utils": major
"@defuse-protocol/intents-sdk": major
---

Enhance NEAR address validation with improved support for different account types

**BREAKING CHANGE**: Rename `isLegitAccountId` to `validateNearAddress` for better clarity
- Add specific validation for Ethereum-style implicit accounts (0x prefix, 42 chars)
- Add validation for NEAR deterministic accounts (0s prefix, 42 chars) 
- Improve validation for standard NEAR implicit accounts (64 hex chars)
- Update account ID regex pattern and length validation logic
- Remove dependency on viem's `isAddress` function for more precise NEAR-specific validation

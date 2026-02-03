---
"@defuse-protocol/contract-types": minor
---

Update defuse contract ABI to v0.4.1

**New Intent Types:**
- `IntentImtMint` - mint tokens to a specified account within the intents contract
- `IntentImtBurn` - burn IMT tokens within the intents contract

**New Types:**
- `StateInit` / `StateInitV1` - initialize receiver contracts via NEP-0616
- `GlobalContractId` - code reference by hash or account_id

**Breaking Changes:**
- `TonConnectPayloadSchema` simplified to only `Text` variant (removed `Binary` and `Cell`)
- Removed `TonConnectPayloadSchemaBinary` and `TonConnectPayloadSchemaCell`
- Removed standalone `AccountId` and `AccountIdRef` type exports (inlined as string)

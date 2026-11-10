---
"@defuse-protocol/intents-sdk": patch
---

Validate `destinationMemo` for PoA Bridge withdrawals. A memo for a chain other than the XRP Ledger now throws `UnsupportedDestinationMemoError`. For the XRP Ledger, the memo must be a destination tag written as decimal digits, from 0 to 4294967295, or `XrplInvalidDestinationTagError` is thrown; this includes the empty string, which was dropped before.

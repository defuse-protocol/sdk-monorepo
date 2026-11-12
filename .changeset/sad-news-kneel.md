---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/intents-sdk": minor
---

- **Stellar:** **BREAKING:** rename `StellarAccountNotFoundError` to `StellarAccountNotFundedError` to match `XrplAccountNotFundedError`. The error `name` and message changed too (`"StellarAccountNotFundedError"`, `"Stellar account is not funded."`). Update `instanceof` checks, imports and any `error.name` comparisons to the new name.

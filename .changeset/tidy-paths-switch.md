---
"@defuse-protocol/internal-utils": patch
---

Extended and fixed exports for @defuse-protocol/internal-utils:

- Extended `poaBridge` exports: now includes `httpClient`, `waitForWithdrawalCompletion`, `constants/blockchains`, `getPendingDeposits`, and `createWithdrawMemo`.
- Extended `solverRelay` exports: now includes `getQuote`, `publishIntents`, `waitForIntentSettlement`, `publishIntent`, `quote`, and types (`Quote`, `FailedQuote`, `IntentSettlementError`, `WaitForIntentSettlementReturnType`, `PublishIntentRequest`, `Params`).
- Extended `utils` exports: now includes `authIdentity`, `prepareBroadcastRequest`, and `tokenUtils`.
- Extended `errors` exports: now includes `toError` from `utils/toError`.
- Main entry point now also exports: `blockchainBalanceService`, `configureSDK`, `config`, `configsByEnvironment`, `NearIntentsEnv`, `RetryOptions`, `RETRY_CONFIGS`, `BaseError`, `serialize`, `nearFailoverRpcProvider`, `PUBLIC_NEAR_RPC_URLS`, `ILogger`, `BlockchainEnum`, `withTimeout`, `request`, and `RequestErrorType`.
- Updated and fixed types and constants for POA bridge and solver relay.

# @defuse-protocol/internal-utils

## 0.5.0

### Minor Changes

- 82f0a04: Add `getStatus` function and export it from `solverRelay`.

## 0.4.0

### Minor Changes

- 468246c: Introduce app fee support.

  - Updated message factory to accept app fee parameters.
  - Exported app fee utilities from the package index.

## 0.3.0

### Minor Changes

- 304381d: Add Stellar signatures support including message types, signature data handling, and multipayload conversion for Stellar wallet integration

### Patch Changes

- 304381d: Export utility functions and type definitions from internal-utils
- 404647a: Update `solverRelay` to include `httpClient` namespace.

## 0.2.0

### Minor Changes

- 89554ed: Re-organize package exports.

  Renamed:

  - `CAIP2_NETWORK` -> `Chains` and `Chain` type

  Removed:

  - `HOT_BRIDGE_CHAINS_CAIP2`
  - Intent relayer

  Added:

  - `createPoaBridgeRoute()` and `createHotBridgeRoute()`
  - Types: `BridgeSDKConfig`, `WithdrawalIdentifier`, `NearWithdrawalRouteConfig`, `InternalTransferRouteConfig`, `VirtualChainRouteConfig`, `PoaBridgeRouteConfig`, `HotBridgeRouteConfig`, `NearTxInfo`, `TxInfo`, `TxNoInfo`, `ParsedAssetInfo`, `ILogger`, `RetryOptions`, `NearIntentsEnv`, `IntentPrimitive`, `IntentPayload`, `IntentPayloadFactory`, `IntentRelayParamsFactory`, `MultiPayload`
  - All error types

- 9c47fd3: Add support for withdrawals to Cardano.

## 0.1.4

### Patch Changes

- 1a93def: Revert "fix(bridge-sdk,internal-utils): fix var and type name collisions (#55)"

## 0.1.3

### Patch Changes

- 43abe56: Fix variable and type names collisions. E.g. `BlockchainEnum` is exported just a regular object.

## 0.1.2

### Patch Changes

- f270534: Fix exporting types of poaBridge and solverRelay namespaces.

## 0.1.1

### Patch Changes

- 390bacc: Improve the type returned by PoA method `supported_tokens`.
- 61d00ec: Change name of network from CoinEasy to EasyChain
- 6d588d6: Make `evmRpc` optional, fallback to public URLs.
- fbe2b7c: Extended and fixed exports for @defuse-protocol/internal-utils:

  - Extended `poaBridge` exports: now includes `httpClient`, `waitForWithdrawalCompletion`, `constants/blockchains`, `getPendingDeposits`, and `createWithdrawMemo`.
  - Extended `solverRelay` exports: now includes `getQuote`, `publishIntents`, `waitForIntentSettlement`, `publishIntent`, `quote`, and types (`Quote`, `FailedQuote`, `IntentSettlementError`, `WaitForIntentSettlementReturnType`, `PublishIntentRequest`, `Params`).
  - Extended `utils` exports: now includes `authIdentity`, `prepareBroadcastRequest`, and `tokenUtils`.
  - Extended `errors` exports: now includes `toError` from `utils/toError`.
  - Main entry point now also exports: `blockchainBalanceService`, `configureSDK`, `config`, `configsByEnvironment`, `NearIntentsEnv`, `RetryOptions`, `RETRY_CONFIGS`, `BaseError`, `serialize`, `nearFailoverRpcProvider`, `PUBLIC_NEAR_RPC_URLS`, `ILogger`, `BlockchainEnum`, `withTimeout`, `request`, and `RequestErrorType`.
  - Updated and fixed types and constants for POA bridge and solver relay.

## 0.1.0

### Minor Changes

- 8e3839b: Reset dependencies versions to avoid conflicts.

## 0.0.12

### Patch Changes

- ef20268: Allow to pass logger to `createWithdrawal()`, `createBatchWithdrawals()`, `estimateWithdrawalFee()` and `waitForWithdrawalCompletion()`.
- 6394062: Allow to pass logger instance to Relay and POA rpc methods.

## 0.0.11

### Patch Changes

- 41986b2: Improve error type returned when intent failed to publish.

## 0.0.10

### Patch Changes

- 8fa7da6: Update stage URLs.

## 0.0.9

### Patch Changes

- a4624a8: Update version of near-api-js
- 345b2d8: Update stage POA bridge and relay urls
- 1d789ed: Add optional `nearRpc` config.

## 0.0.8

### Patch Changes

- cdd7633: Fix intercepting timeout error. Previously every AbortError were considered as a timeout error.
- 84ce5e1: Add `poaTokenFactoryContractID` to internal-utils global configuration.
- 127041a: Allow to pass `retryOptions` to POA's `waitForWithdrawalCompletion`. By default, it retries for 2 mins.
- 48ac772: Fix propagating AbortError when passed to `request()`.
- 29579ce: Export config related variables and functions (`config`, `configureSDK`, `configsByEnvironment` and `NearIntentsEnv`) from the package.
- ce86177: Fix aborting retries of RPC calls when the error is not retriable.
- db52295: Allow specifying POA bridge and Solver API URLs per RPC call.
- 98ad047: Allow to pass `retryOptions` to `waitForIntentSettlement`. By default, it retries for 2 mins.

## 0.0.7

### Patch Changes

- b06d635: Add CommonJS versions of packages
- Updated dependencies [b06d635]
  - @defuse-protocol/contract-types@0.0.3

## 0.0.6

### Patch Changes

- de91a66: Fix importing FailoverProvider

## 0.0.5

### Patch Changes

- 2e8417a: Fix importing commonjs packages

## 0.0.4

### Patch Changes

- f842479: Export POA bridge chains

## 0.0.3

### Patch Changes

- 5684e83: Fix workspace:\* version

## 0.0.2

### Patch Changes

- febce69: Add missing @defuse-protocol/contract-types dependency

## 0.0.1

### Patch Changes

- e16e83b: Create internal-utils package instead of defuse-sdk use

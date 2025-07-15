# @defuse-protocol/internal-utils

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

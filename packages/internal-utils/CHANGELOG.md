# @defuse-protocol/internal-utils

## 0.16.0

### Minor Changes

- 8bf4c85: Add new quote params - minWaitMs, maxWaitMs, trustedMetadata.

## 0.15.2

### Patch Changes

- 160a024: Enhance NEAR address validation with improved support for different account types

  - Rename `isLegitAccountId` to `validateNearAddress` for better clarity
  - Add specific validation for Ethereum-style implicit accounts (0x prefix, 42 chars)
  - Add validation for NEAR deterministic accounts (0s prefix, 42 chars)
  - Improve validation for standard NEAR implicit accounts (64 hex chars)

## 0.15.1

### Patch Changes

- c7248dc: Fix running libs in browsers.
- Updated dependencies [c7248dc]
  - @defuse-protocol/contract-types@0.1.2

## 0.15.0

### Minor Changes

- f0fcc2f: Add support for solver api authorization key

### Patch Changes

- 84f800a: Make intent status polling less aggressive but longer.

## 0.14.0

### Minor Changes

- 040251a: Add address validation to validateWithdrawal step

## 0.13.0

### Minor Changes

- 322977c: Add `onTxHashKnown` parameter to `waitForIntentSettlement()`. The callback is called with the intent's tx hash as soon it's known.

### Patch Changes

- 79d0bcd: Change default list of NEAR RPCs.
- aa221dc: Change intent status polling to be more aggressive.

## 0.12.0

### Minor Changes

- db94b03: Add storage_balance_of check before withdrawing
  Use custom near provider for near requests
  LRU cache for storage deposit
  Cache only successful non-null results
  Export and adjust queryContract from internal-utils package

## 0.11.1

### Patch Changes

- e5d9a9c: Do not bundle into single file. Use `tsdown` for transpiling.
- Updated dependencies [e5d9a9c]
  - @defuse-protocol/contract-types@0.1.1

## 0.11.0

### Minor Changes

- b56e8c8: Allow overriding preset environment config using `configureSDK()`.

## 0.10.0

### Minor Changes

- 01aa81c: Remove STELLAR_RAW signature type support.

## 0.9.1

### Patch Changes

- 4543eb2: Add missing Tron authentication method to AuthMethod enum.

## 0.9.0

### Minor Changes

- c49717b: Add TIP-191 standard support for Tron wallet signatures.

### Patch Changes

- Updated dependencies [c49717b]
  - @defuse-protocol/contract-types@0.1.0

## 0.8.2

### Patch Changes

- 25d2e40: Add `?method=xxx` to Intents RPC requests.

## 0.8.1

### Patch Changes

- 3cbae8c: Remove `omniBridgeRelayerBaseUrl` from config.

## 0.8.0

### Minor Changes

- 200fc6f: Add SEP-0053 standard support for Stellar wallet signatures.

### Patch Changes

- 9b9d6a8: Remove @hot-labs/omni-sdk package

## 0.7.0

### Minor Changes

- 7732be8: Adds omni bridge support
- 9edf920: Simplify `ILogger` interface to satisfy `console`.

### Patch Changes

- f20577a: Switch Aurora RPC endpoint to new URL for proper load balancing and multi-region failover.

## 0.6.0

### Minor Changes

- 4a66bf7: Adds Aurora Devnet network

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

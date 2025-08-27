# @defuse-protocol/intents-sdk

## 0.19.2

### Patch Changes

- 4543eb2: Add missing Tron authentication method to AuthMethod enum.
- Updated dependencies [4543eb2]
  - @defuse-protocol/internal-utils@0.9.1

## 0.19.1

### Patch Changes

- 9a9120a: Update to @hot-labs/omni-sdk@2.20.2

## 0.19.0

### Minor Changes

- 1d9bba2: Return support for omni bridge and refactor it and fix bugs

## 0.18.0

### Minor Changes

- c49717b: Add TIP-191 standard support for Tron wallet signatures.

### Patch Changes

- Updated dependencies [c49717b]
- Updated dependencies [c49717b]
  - @defuse-protocol/internal-utils@0.9.0
  - @defuse-protocol/contract-types@0.1.0

## 0.17.1

### Patch Changes

- 13217ad: Upgrade hot-omni-sdk dependency.

## 0.17.0

### Minor Changes

- 41b04ac: Rename `createOmniWithdrawalRoute()` to `createOmniBridgeRoute()`.
- 9936458: Add stricter validation of `assetId`. Add new `UnsupportedAssetIdError` error.

### Patch Changes

- 9b41de4: When the fee token can't be obtained using exact_out strategy, then fallback to exact_in with x1.2 coef.

## 0.16.4

### Patch Changes

- Updated dependencies [25d2e40]
  - @defuse-protocol/internal-utils@0.8.2

## 0.16.3

### Patch Changes

- ccab9ca: Temporary disable Omni Bridge.

## 0.16.2

### Patch Changes

- Updated dependencies [3cbae8c]
  - @defuse-protocol/internal-utils@0.8.1

## 0.16.1

### Patch Changes

- 3c58f82: Update readme and add missing omni exports
- Updated dependencies [200fc6f]
- Updated dependencies [9b9d6a8]
  - @defuse-protocol/internal-utils@0.8.0

## 0.16.0

### Minor Changes

- 058ecec: Add withdrawal to specific chain via omni bridge

## 0.15.0

### Minor Changes

- 7732be8: Adds omni bridge support

### Patch Changes

- Updated dependencies [f20577a]
- Updated dependencies [7732be8]
- Updated dependencies [9edf920]
  - @defuse-protocol/internal-utils@0.7.0

## 0.14.0

### Minor Changes

- b1195dc: Rename `BridgeSDK` to `IntentsSDK`.

## 0.13.2

### Patch Changes

- aa83092: Make `destinationMemo` field optional.
- 8a637b7: Add `tokenAddress` to `TrustlineNotFoundError`.

## 0.13.1

### Patch Changes

- Updated dependencies [4a66bf7]
  - @defuse-protocol/internal-utils@0.6.0

## 0.13.0

### Minor Changes

- 283a27a: Rename `ticket` to `intentHash` in `IntentPublishResult` type.

## 0.12.0

### Minor Changes

- 82f0a04: Remove `BatchWithdrawalImpl` and `SingleWithdrawalImpl`.
  Introduce more methods for granular control over the execution, which support single and batch withdrawals.

  New intent-specific methods:

  - `signAndSendIntent()`
  - `waitForIntentSettlement()`
  - `getIntentStatus()`

  New withdraw-specific methods:

  - `signAndSendWithdrawalIntent()`
  - `processWithdrawal()` (replacement for deleted classes)

  Changed signatures:

  - `waitForWithdrawalCompletion()`

### Patch Changes

- Updated dependencies [82f0a04]
  - @defuse-protocol/internal-utils@0.5.0

## 0.11.2

### Patch Changes

- Updated dependencies [468246c]
  - @defuse-protocol/internal-utils@0.4.0

## 0.11.1

### Patch Changes

- Updated dependencies [304381d]
- Updated dependencies [304381d]
- Updated dependencies [404647a]
  - @defuse-protocol/internal-utils@0.3.0

## 0.11.0

### Minor Changes

- d51f0db: Bump `@hot-labs/omni-sdk` to v2.16.0.
  Change Stellar RPC URL configuration to include both Horizon and Soroban servers.
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
- 7c39b2c: Add `onBeforePublishIntent` hook to process intents before publishing.
- 89554ed: Replace `nearRpc`, `evmRpc` and `stellarRpc` configs with a unified `rpc` config. Example:

  ```typescript
  import { Chains, BridgeSDK } from "@defuse-protocol/bridge-sdk";

  const sdk = new BridgeSDK({
    rpc: {
      [Chains.Near]: ["https://rpc.mainnet.near.org"],
      [Chains.Polygon]: ["https://polygon-rpc.com"],
      [Chains.BNB]: ["https://bsc-dataseed.binance.org"],
    },
  });
  ```

### Patch Changes

- e0bc679: Improve withdrawal validation to Stellar: ensure the destination address has a trustline for a token.
- d0340a7: Automatically append withdrawal intents. Example:

  ```typescript
  // Previously
  bridgeSDK.createBatchWithdrawals({
      intent: {
          payload: (intentParams) => ({
              intents: [...moreIntents, ...intentParams.intents],
          })
      }
  )

  // Now
  bridgeSDK.createBatchWithdrawals({
      intent: {
          payload: () => ({
              intents: moreIntents,
          })
      }
  )
  ```

- Updated dependencies [89554ed]
- Updated dependencies [9c47fd3]
  - @defuse-protocol/internal-utils@0.2.0

## 0.10.3

### Patch Changes

- 0b80a13: Update `IntentSignerNEP413` to support formatted signature ("ed25519:<base58>").

## 0.10.2

### Patch Changes

- 1a93def: Revert "fix(bridge-sdk,internal-utils): fix var and type name collisions (#55)"
- Updated dependencies [1a93def]
  - @defuse-protocol/internal-utils@0.1.4

## 0.10.1

### Patch Changes

- 43abe56: Fix variable and type names collisions. E.g. `BlockchainEnum` is exported just a regular object.
- Updated dependencies [43abe56]
  - @defuse-protocol/internal-utils@0.1.3

## 0.10.0

### Minor Changes

- 4a8e639: Add Stellar chain support using Hot bridge:
  - add Stellar to `HOT_BRIDGE_CHAINS_CAIP2` list
  - add new optional `stellarRpc` config
  - add `UnsupportedDestinationMemoError` error

## 0.9.1

### Patch Changes

- Updated dependencies [f270534]
  - @defuse-protocol/internal-utils@0.1.2

## 0.9.0

### Minor Changes

- 390bacc: Add minimum withdrawal amount validation for POA bridge. POA bridge now validates minimum withdrawal amounts (e.g., ZCash requires 1.0 minimum). Adds `MinWithdrawalAmountError`.
- 5f1ed8f: Add new utility functions to create intent signers. Add `createIntentSignerNEP413()`, `createIntentSignerNearKeyPair()` and `createIntentSignerViem()`.
- 237943b: Change `ParsedAssetInfo` to include `bridgeName` instead of `route`. Export `BridgeNameEnum` and `RouteConfig`.

### Patch Changes

- 237943b: Add new utility functions for creating route configs:
  - `createInternalTransferRoute()`
  - `createNearWithdrawalRoute()`
  - `createVirtualChainRoute()`
  - `createDefaultRoute()`
- 6d588d6: Make `evmRpc` optional, fallback to public URLs.
- Updated dependencies [390bacc]
- Updated dependencies [61d00ec]
- Updated dependencies [6d588d6]
- Updated dependencies [fbe2b7c]
  - @defuse-protocol/internal-utils@0.1.1

## 0.8.1

### Patch Changes

- 8734397: Fix passing Near RPC URLs to omni-sdk.

## 0.8.0

### Minor Changes

- 8e3839b: Reset dependencies versions to avoid conflicts.

### Patch Changes

- Updated dependencies [8e3839b]
  - @defuse-protocol/internal-utils@0.1.0

## 0.7.6

### Patch Changes

- ef20268: Allow to pass logger to `createWithdrawal()`, `createBatchWithdrawals()`, `estimateWithdrawalFee()` and `waitForWithdrawalCompletion()`.
- Updated dependencies [ef20268]
- Updated dependencies [6394062]
  - @defuse-protocol/internal-utils@0.0.12

## 0.7.5

### Patch Changes

- Updated dependencies [41986b2]
  - @defuse-protocol/internal-utils@0.0.11

## 0.7.4

### Patch Changes

- c626563: Fix passing `msg` when withdrawing wrap.near
- Updated dependencies [8fa7da6]
  - @defuse-protocol/internal-utils@0.0.10

## 0.7.3

### Patch Changes

- a4624a8: Update version of near-api-js
- 1d789ed: Add optional `nearRpc` config.
- Updated dependencies [a4624a8]
- Updated dependencies [345b2d8]
- Updated dependencies [1d789ed]
  - @defuse-protocol/internal-utils@0.0.9

## 0.7.2

### Patch Changes

- cb50e56: Add new method `getWithdrawal()` to batch withdrawals.
- f98bcec: Add support for Sui and Aptos networks in the POA bridge

## 0.7.1

### Patch Changes

- 33ff7a1: Add a new optional parameter to SDK `env` ("production" or "stage"). Depending on the passed environment:
  - will be used the appropriate API servers for POA Bridge and Solver Relay.
  - POA Bridge will handle only either `omft.near` or `stft.near` tokens.
- 88ee477: Allow specifying wait_ms parameter for fee quotes.
- 127041a: Allow to pass `retryOptions` to POA's `waitForWithdrawalCompletion`. By default, it retries for 2 mins.
- 49ea900: Add mandatory `referral` parameter to SDK. Allow to set `referral` per withdrawal.
- 78fcfbd: Allow to pass custom `msg` when withdrawing to Near
- 29579ce: Export config related variables and functions (`config`, `configureSDK`, `configsByEnvironment` and `NearIntentsEnv`) from the package.
- d13a98a: Export `WithdrawalParams` type.
- e435f9c: Export new constant `HOT_BRIDGE_CHAINS_CAIP2` which is an array of CAIP2 strings that HOT Bridge suppports.
- dc89480: Export `CAIP2_NETWORK` enum like object.
- db52295: Allow specifying POA bridge and Solver API URLs per RPC call.
- a6ba8c6: Add signal and retryOptions to `waitForWithdrawalCompletion`.
- Updated dependencies [cdd7633]
- Updated dependencies [84ce5e1]
- Updated dependencies [127041a]
- Updated dependencies [48ac772]
- Updated dependencies [29579ce]
- Updated dependencies [ce86177]
- Updated dependencies [db52295]
- Updated dependencies [98ad047]
  - @defuse-protocol/internal-utils@0.0.8

## 0.7.0

### Minor Changes

- d5feb37: Add support for withdrawals to virtual chains with non-ETH base token. Change `bridgeConfig` for `aurora_engine`, require to explicitly specify `proxyTokenContractId`.

## 0.6.0

### Minor Changes

- 481cb85: Add Intents bridge for withdrawing within the Intents.
- 7064be6: Add new method `addWithdrawal()` to `BatchWithdrawalImpl` to allow appending a withdrawal to existing batch.
  Add new method `withdrawalsCount()` to `BatchWithdrawalImpl` that returns total withdrawals number.

### Patch Changes

- f235808: Allow specifying intent signer per withdrawal

## 0.5.2

### Patch Changes

- 5fb866c: Fix estimating native NEAR withdrawal

## 0.5.1

### Patch Changes

- b06d635: Add CommonJS versions of packages
- 8187ec7: Allow to pass entire withdrawal params object to `estimateWithdrawalFee`
- Updated dependencies [b06d635]
  - @defuse-protocol/contract-types@0.0.3
  - @defuse-protocol/internal-utils@0.0.7

## 0.5.0

### Minor Changes

- 15d57f2: Add Avalanche network support to HOT bridge

## 0.4.1

### Patch Changes

- d6fcfa4: Fix incorrect fee asset ID for Optimism

## 0.4.0

### Minor Changes

- 7af5822: Add Optimism network support to HOT bridge

## 0.3.2

### Patch Changes

- 982c597: Relax on `sdk.estimateWithdrawalFee` type

## 0.3.1

### Patch Changes

- 93f9d6a: Relax on `estimateWithdrawalFee` type

## 0.3.0

### Minor Changes

- 547f6d6: Format destination tx hash. Update `waitForWithdrawalCompletion` interface.

## 0.2.0

### Minor Changes

- 0a2e898: Add support for AuroraEngine chains

## 0.1.10

### Patch Changes

- f3d0b26: Fix withdrawn amount of native token

## 0.1.9

### Patch Changes

- 3bd9c13: Fix fee asset id for TON

## 0.1.8

### Patch Changes

- 71237a9: Store fee estimation in FeeExceedsAmountError error

## 0.1.7

### Patch Changes

- 51c9025: Export `FeeExceedsAmountError`

## 0.1.6

### Patch Changes

- Updated dependencies [de91a66]
  - @defuse-protocol/internal-utils@0.0.6

## 0.1.5

### Patch Changes

- 2e8417a: Fix importing commonjs packages
- Updated dependencies [2e8417a]
  - @defuse-protocol/internal-utils@0.0.5

## 0.1.4

### Patch Changes

- 59510fb: Export FeeEstimation type

## 0.1.3

### Patch Changes

- f842479: Add all supported chains by POA
- affa4e6: Add TON fee token
- Updated dependencies [f842479]
  - @defuse-protocol/internal-utils@0.0.4

## 0.1.2

### Patch Changes

- 5684e83: Fix workspace:\* version
- Updated dependencies [5684e83]
  - @defuse-protocol/internal-utils@0.0.3

## 0.1.1

### Patch Changes

- Updated dependencies [febce69]
  - @defuse-protocol/internal-utils@0.0.2

## 0.1.0

### Minor Changes

- 578992d: Simplify overriding the intent payload
- b9340e7: Derive bridge for a withdrawn asset from its name
- 25f8859: Remove `sourceAddress`, derive it from `assetId`
- 32a47e1: Automatically unwrap wNEAR upon withdrawal
- 14c9421: Simplify instantiation of the sdk
- 5c01d58: Remove `destinationChain` field and derive chain information from `assetId`

### Patch Changes

- 60e1a04: Fix withdrawing NEP-141 to account without storage
- bcba3fc: Mark all packages as side effect free
- e16e83b: Create internal-utils package instead of defuse-sdk use
- Updated dependencies [bcba3fc]
- Updated dependencies [e16e83b]
  - @defuse-protocol/contract-types@0.0.2
  - @defuse-protocol/internal-utils@0.0.1

## 0.0.2

### Patch Changes

- 3d97f8c: Bump @hot-labs/omni-sdk to 2.8.3 and get rid of monkey-patch

## 0.0.1

### Patch Changes

- 1eb75f5: Initial release
- Updated dependencies [1eb75f5]
  - @defuse-protocol/contract-types@0.0.1

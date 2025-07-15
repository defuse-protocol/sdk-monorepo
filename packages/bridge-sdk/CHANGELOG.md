# @defuse-protocol/bridge-sdk

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

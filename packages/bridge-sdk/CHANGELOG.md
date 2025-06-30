# @defuse-protocol/bridge-sdk

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

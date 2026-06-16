# @defuse-protocol/crosschain-assetid

## 1.7.0

### Minor Changes

- a7c4fd9: Add Fogo support via omni and remove it from PoA

## 1.6.0

### Minor Changes

- 9e88214: Add HyperCore to caip2 chains

## 1.5.1

### Patch Changes

- 39df660: Point CJS consumers at `.d.cts` type declarations via conditional `exports`. With `"type": "module"` set, every `.d.ts` file is interpreted as ESM-flavored types under `moduleResolution: node16`/`nodenext`/`bundler`, which can cause subtle interop mismatches (e.g. around default exports) for CJS consumers. tsdown already emits the `.d.cts` artifacts; this change wires them into the `exports` map so they actually get resolved.

## 1.5.0

### Minor Changes

- 4fd76f4: Add starknet support for Omni Bridge

## 1.4.0

### Minor Changes

- a7a8658: Add Abstract chain support

## 1.3.0

### Minor Changes

- 781fee2: Add dash network support

## 1.2.0

### Minor Changes

- d4e0311: add Aleo network support

## 1.1.1

### Patch Changes

- 414bcbf: Upgrade build tooling (tsdown) from 0.15.5 to 0.19.0

## 1.1.0

### Minor Changes

- dd7b27d: Add support for Plasma and Scroll network to Hot bridge

## 1.0.4

### Patch Changes

- ad79b98: Add ADI chain slug.

## 1.0.3

### Patch Changes

- a8ff564: Monad mainnet withdrawals are now available through the HOT bridge with the correct 143 network id.

## 1.0.2

### Patch Changes

- c7248dc: Fix running libs in browsers.

## 1.0.1

### Patch Changes

- e5d9a9c: Do not bundle into single file. Use `tsdown` for transpiling.

## 1.0.0

### Major Changes

- 31b362d: Release `@defuse-protocol/crosschain-assetid` package.

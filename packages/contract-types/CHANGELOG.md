# @defuse-protocol/contract-types

## 0.4.0

### Minor Changes

- ae31e9e: Export JSON Schema. It is located in "/schemas/intents.schema.json".
- ae31e9e: Re-generate types from contract ABI:

  - Remove internal types
  - Disallow extra fields from objects
  - Improve polymorphic (discriminated union) objects

## 0.3.1

### Patch Changes

- 2d38a96: Fix generating types for `webauthn` multipayload.

## 0.3.0

### Minor Changes

- 5edb8fa: Re-generate types from contract ABI.

## 0.2.0

### Minor Changes

- 9dfbecf: Update ABI of the contract.

## 0.1.2

### Patch Changes

- c7248dc: Fix running libs in browsers.

## 0.1.1

### Patch Changes

- e5d9a9c: Do not bundle into single file. Use `tsdown` for transpiling.

## 0.1.0

### Minor Changes

- c49717b: Extend MultiPayload with TIP-191 support.

## 0.0.3

### Patch Changes

- b06d635: Add CommonJS versions of packages

## 0.0.2

### Patch Changes

- bcba3fc: Mark all packages as side effect free

## 0.0.1

### Patch Changes

- 1eb75f5: Initial release

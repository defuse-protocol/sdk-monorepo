# @defuse-protocol/contract-types

## 0.6.1

### Patch Changes

- be5c0fb: fix: tip191 (Tron) and sep53 (Stellar) validation in MultiPayloadValidator

  parseJson keyword was mutating payload data during oneOf evaluation, corrupting sibling branches. Deferred mutations until after AJV selects the matching branch.

## 0.6.0

### Minor Changes

- 98c96ca: Update defuse contract ABI to v0.4.1

  **New Intent Types:**
  - `IntentImtMint` - mint tokens to a specified account within the intents contract
  - `IntentImtBurn` - burn IMT tokens within the intents contract

  **New Types:**
  - `StateInit` / `StateInitV1` - initialize receiver contracts via NEP-0616
  - `GlobalContractId` - code reference by hash or account_id

  **Breaking Changes:**
  - `TonConnectPayloadSchema` simplified to only `Text` variant (removed `Binary` and `Cell`)
  - Removed `TonConnectPayloadSchemaBinary` and `TonConnectPayloadSchemaCell`
  - Removed standalone `AccountId` and `AccountIdRef` type exports (inlined as string)

## 0.5.0

### Minor Changes

- fecef80: Add Standard Schema compliant validators with lazy compilation and type inference helpers

  ## New Export Added: `@defuse-protocol/contract-types/validate`. Example Usage:

  ```typescript
  import {
    MultiPayloadNarrowedValidator,
    type InferOutput,
  } from "@defuse-protocol/contract-types/validate";

  // Validate data
  const result = MultiPayloadNarrowedValidator.validate(data);
  if (result.issues) {
    console.error("Validation failed:", result.issues);
  } else {
    // result.value is typed as MultiPayloadNarrowed__Parsed
    console.log(result.value);
  }

  // Type inference if you need it (all the types are available to be imported directly from @defuse-protocol/contract-types as before)
  type MyPayload = InferOutput<typeof MultiPayloadNarrowedValidator>;
  ```

  ## Library Integrations

  Works with any Standard Schema compatible library. See test files for copyable wrapper code:
  - **Hono/tRPC/TanStack Form** - use validators directly (Standard Schema)
  - **class-validator (NestJS)** - see `class-validator.test.ts` for `ValidateWithSchema` decorator
  - **Zod** - see `zod.test.ts` for `toZodSchema()` wrapper
  - **Valibot** - see `valibot.test.ts` for `toValibotSchema()` wrapper
  - **ArkType** - see `arktype.test.ts` for `toArkTypeSchema()` wrapper

## 0.4.4

### Patch Changes

- 414bcbf: Upgrade build tooling (tsdown) from 0.15.5 to 0.19.0

## 0.4.3

### Patch Changes

- 487f6e2: Remove `contentEncoding` and related `format` properties.

## 0.4.2

### Patch Changes

- 50b1597: Add "discriminator"."mapping" to polymorphic objects for better Openapi compatibility.

## 0.4.1

### Patch Changes

- d3c1bfd: Add the "schemas" folder to the package.

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

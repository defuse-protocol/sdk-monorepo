# @defuse-protocol/contract-types

This package provides TypeScript type definitions for Defuse Protocol contracts. It contains automatically generated TypeScript interfaces derived from the Defuse Protocol contract ABI.

## Installation

```bash
npm install @defuse-protocol/contract-types
```

## Standard Schema

Validators are [Standard Schema](https://standardschema.dev/) compliant and work with any library that accepts the spec (TanStack Form, Hono, tRPC, etc.). See [standard-schema.test.ts](./src/standard-schema.test.ts) for usage examples.

## Using with Schema Libraries

### class-validator (NestJS)

See [class-validator.test.ts](./src/class-validator.test.ts) for the `ValidateWithSchema` decorator that works with NestJS validation pipes.

### Zod

Two options available in [zod.test.ts](./src/zod.test.ts):
- `z.fromJSONSchema()` - validates raw structure only, no JSON string parsing
- `toZodSchema()` wrapper - validates and parses inner JSON strings

### Valibot

See [valibot.test.ts](./src/valibot.test.ts) for the wrapper function.

### ArkType

See [arktype.test.ts](./src/arktype.test.ts) for the wrapper function.

## Usage

```typescript
import { Intent } from '@defuse-protocol/contract-types';

// Use the generated types in your application
const transferIntent: Intent = {
  intent: "transfer",
  receiver_id: "receiver.near",
  tokens: {
    "token.near": "1000000000000000000000000"
  }
};
```

## Available Types

This package exports the following TypeScript types:

- `Intent` - Types for various intent actions (transfer, add_public_key, remove_public_key, etc.)
- And other contract-related types derived from the Defuse Protocol ABI

## Development

### Prerequisites

- [PNPM](https://pnpm.io) (v10.14.0)

### Build

```bash
pnpm run build
```

### Generating Types

The types are automatically generated from the Defuse Protocol contract ABI using the script at `scripts/gen-defuse-types.ts`. This script extracts the type definitions from the contract ABI and converts them to TypeScript interfaces.

To regenerate the types:

```bash
# Run the type generation script
cd packages/contract-types
pnpm run gen-defuse-types
```

### Development Mode

```bash
pnpm run dev
```

### Lint

```bash
pnpm run lint
```

## License

MIT License © 2025 NEAR Foundation

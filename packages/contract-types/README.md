# @defuse-protocol/contract-types

This package provides TypeScript type definitions for Defuse Protocol contracts. It contains automatically generated TypeScript interfaces derived from the Defuse Protocol contract ABI.

## Installation

```bash
# Using npm
npm install @defuse-protocol/contract-types

# Using yarn
yarn add @defuse-protocol/contract-types

# Using pnpm
pnpm add @defuse-protocol/contract-types

# Using bun
bun add @defuse-protocol/contract-types
```

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

- [Bun](https://bun.sh) (v1.2.16 or later)

### Build

```bash
bun run build
```

### Generating Types

The types are automatically generated from the Defuse Protocol contract ABI using the script at `scripts/gen-defuse-types.sh`. This script extracts the type definitions from the contract ABI and converts them to TypeScript interfaces.

To regenerate the types:

```bash
# Run the type generation script
cd packages/contract-types
./scripts/gen-defuse-types.sh
```

### Development Mode

```bash
bun run dev
```

### Lint

```bash
bun run lint
```

## License

MIT

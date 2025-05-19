# @defuse-protocol/contract-types

This package provides TypeScript type definitions for Defuse Protocol contracts.

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
import { greet } from '@defuse-protocol/contract-types';

// Use the types in your application
const greeting = greet('World');
console.log(greeting); // "Hello, World!"
```

## Development

### Prerequisites

- [Bun](https://bun.sh) (v1.2.13 or later)

### Build

```bash
bun run build
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

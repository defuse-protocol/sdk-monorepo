# @defuse-protocol/bridge-sdk

The Bridge SDK for Defuse Protocol provides a comprehensive set of tools for interacting with various bridge implementations. It simplifies the process of transferring assets between different blockchains.

## Features

- Support for multiple bridge implementations (Direct, Hot, POA)
- Withdrawal functionality (single and batch)
- Intent-based operations with customizable signers and relayers
- Fee estimation and validation
- TypeScript support with comprehensive type definitions

## Installation

```bash
# Using npm
npm install @defuse-protocol/bridge-sdk

# Using yarn
yarn add @defuse-protocol/bridge-sdk

# Using pnpm
pnpm add @defuse-protocol/bridge-sdk

# Using bun
bun add @defuse-protocol/bridge-sdk
```

## Quick Start

```typescript
import { BridgeSDK } from '@defuse-protocol/bridge-sdk';

// Initialize the SDK with appropriate bridges and intent handlers
const sdk = new BridgeSDK({
  bridges: [...],
  intentRelayer: {...},
  intentSigner: {...}
});

// Create a withdrawal
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: {
    // withdrawal parameters
  }
});

// Execute the withdrawal
const result = await withdrawal.execute();
```

## Development

### Prerequisites

- [Bun](https://bun.sh) (v1.2.13 or later)

### Setup

```bash
# Install dependencies
bun install
```

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

### Format

```bash
bun run format
```

## Advanced Usage

### Working with Different Bridge Types

The SDK supports multiple bridge implementations:

```typescript
import { 
  DirectBridge, 
  HotBridge, 
  PoaBridge 
} from '@defuse-protocol/bridge-sdk';

// Initialize a direct bridge
const directBridge = new DirectBridge({...});

// Initialize a hot bridge
const hotBridge = new HotBridge({...});

// Initialize a POA bridge
const poaBridge = new PoaBridge({...});

// Use in the SDK
const sdk = new BridgeSDK({
  bridges: [directBridge, hotBridge, poaBridge],
  // ...other config
});
```

### Batch Withdrawals

```typescript
const batchWithdrawal = sdk.createBatchWithdrawals({
  withdrawalParams: [
    // multiple withdrawal parameter objects
  ]
});

const results = await batchWithdrawal.execute();
```

### Custom Intent Handling

The SDK allows for custom intent payload and relay parameter factories:

```typescript
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: {...},
  intent: {
    payload: (params) => { /* custom payload logic */ },
    relayParams: (params) => { /* custom relay params logic */ }
  }
});
```

## License

MIT

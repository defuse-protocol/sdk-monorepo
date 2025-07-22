# @defuse-protocol/bridge-sdk

The Bridge SDK for Near Intents provides a set of tools for interacting with various bridge implementations. It simplifies the process of transferring assets from Near Intents to different blockchains.

## Features

- Support for multiple bridge implementations (Hot, PoA)
- Single and batch withdrawal operations
- Automatic fee estimation
- Transfers within Near Intents
- Transfers to NEAR blockchain
- Transfers to Virtual Chains (e.g. Aurora)

## Installation

```bash
npm install @defuse-protocol/bridge-sdk --save-exact
```

## Quick Start

```typescript
import { BridgeSDK, createIntentSignerNearKeyPair } from '@defuse-protocol/bridge-sdk';
import { KeyPair } from 'near-api-js';

// Initialize the SDK with required configuration
const sdk = new BridgeSDK({
    referral: 'your-referral-code', // Only referral is required
});

// Set up intent signer (for NEAR)
const keypair = KeyPair.fromString('your-private-key');
const signer = createIntentSignerNearKeyPair({
  keypair: keypair,
  accountId: 'your-account.near'
});
sdk.setIntentSigner(signer);

// Create a withdrawal
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near', // Asset identifier
    amount: 1000000n, // Amount in smallest unit
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false, // Whether amount includes fees
    // routeConfig is optional - will be auto-detected from assetId
  }
});

// Execute the withdrawal (all steps in one call)
await withdrawal.process();

// Or execute step by step for more control:
// await withdrawal.estimateFee();
// await withdrawal.signAndSendIntent();
// await withdrawal.waitForIntentSettlement();
// await withdrawal.waitForWithdrawalCompletion();
```

## Core Concepts

### Route and Bridge Enums

The SDK uses two key concepts to organize withdrawal operations:

#### Routes
Routes define the **path** a withdrawal takes - the specific mechanism and destination for transferring assets. Each route represents a different withdrawal flow:

```typescript
import { RouteEnum } from '@defuse-protocol/bridge-sdk';

console.log(RouteEnum.HotBridge);        // "hot_bridge" - Cross-chain via HOT protocol
console.log(RouteEnum.PoaBridge);        // "poa_bridge" - Cross-chain via PoA bridge
console.log(RouteEnum.NearWithdrawal);   // "near_withdrawal" - Direct to NEAR blockchain
console.log(RouteEnum.VirtualChain);     // "virtual_chain" - To Aurora Engine chains
console.log(RouteEnum.InternalTransfer); // "internal_transfer" - Between protocol users
```

#### Bridge Names
Bridge names identify the **underlying bridge infrastructure** that handles the cross-chain transfer. This determines which external protocol processes the withdrawal:

```typescript
import { BridgeNameEnum } from '@defuse-protocol/bridge-sdk';

console.log(BridgeNameEnum.Hot);  // "hot" - HOT Labs bridge infrastructure
console.log(BridgeNameEnum.Poa);  // "poa" - Proof-of-Authority bridge by Defuse Labs  
console.log(BridgeNameEnum.None); // null - No external bridge (NEAR-native or internal)
```

**Key Difference**: 
- **Route** = "How and where" the withdrawal goes (the path)
- **Bridge Name** = "Who operates" the underlying infrastructure (the bridge provider)

For example, both `hot_bridge` and `poa_bridge` routes perform cross-chain transfers, but use different bridge infrastructures (`hot` vs `poa`) with different fee structures and supported networks.

### Asset Identifiers

The SDK uses standardized asset identifiers in the format:
- `nep141:contract.near` - NEP-141 tokens
- `nep245:contract.near:tokenId` - NEP-245 multi-tokens

Asset Identifier uniquely determines the corresponding route and destination chain.

Examples:
- `nep141:usdt.tether-token.near` - USDT on NEAR
- `nep141:wrap.near` - Wrapped NEAR (native NEAR)
- `nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L` - Polygon USDC through Hot
- `nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near` - Base USDC through PoA

### Intent Signers

Intent signers are required to authenticate and sign withdrawal operations. The SDK supports multiple signing methods:

- **NEAR KeyPair Signer** - Use NEAR account private keys for signing
- **NEP-413 Signer** - Custom message signing implementation 
- **EVM/Viem Signer** - Use Ethereum-compatible wallets and accounts

You must set an intent signer before processing withdrawals:

```typescript
// Example: Set up a NEAR KeyPair signer
const signer = createIntentSignerNearKeyPair({
  keypair: KeyPair.fromString('your-private-key'),
  accountId: 'your-account.near'
});
sdk.setIntentSigner(signer);
```

See the [Intent Signers](#intent-signers-1) section below for detailed implementation examples.

## Route Types

The SDK automatically detects and supports multiple route types based on asset identifiers:

### Hot Bridge Route
- **Purpose**: Cross-chain transfers via HOT Labs infrastructure
- **Supported Assets**: Multi-tokens (NEP-245) from Hot protocol (contract `v2_1.omni.hot.tg`)
- **Use Case**: Cross-chain transfers for assets bridged through Hot protocol
- **Route Type**: `hot_bridge`

### PoA Bridge Route  
- **Purpose**: Proof-of-Authority bridge transfers operated by Defuse Labs
- **Supported Assets**: Fungible tokens (NEP-141) ending with `.omft.near`
- **Use Case**: Cross-chain transfers for assets bridged through PoA protocol
- **Route Type**: `poa_bridge`

### Internal Transfer Route
- **Purpose**: Transfer between Near Intents users within the protocol
- **Supported Assets**: All NEP-141 and NEP-245 tokens
- **Use Case**: User A having funds in the protocol wants to transfer to User B
- **Route Type**: `internal_transfer`

### Near Withdrawal Route
- **Purpose**: Transfers within the NEAR blockchain
- **Supported Assets**: NEP-141 tokens on NEAR, including native NEAR (wrap.near)
- **Use Case**: Same-chain transfers on NEAR
- **Route Type**: `near_withdrawal`

### Virtual Chain Route
- **Purpose**: Transfers to Aurora Engine-powered chains (aka Virtual chains)
- **Supported Assets**: NEP-141 tokens with Aurora Engine integration
- **Use Case**: Near Intents to Aurora ecosystem transfers
- **Route Type**: `virtual_chain`
- **Note**: Requires explicit `routeConfig` with `auroraEngineContractId`

### Fee Estimation

```typescript
// Get fee estimation for a withdrawal
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false
  }
});

// Estimate fee before processing
const feeAmount = await withdrawal.estimateFee();
console.log('Fee amount:', feeAmount);

// Or get detailed fee estimation from SDK
const feeEstimation = await sdk.estimateWithdrawalFee({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false
  }
});

console.log('Fee amount:', feeEstimation.amount);
// Quote is null in case the fee is paid with withdrawn token 
console.log('Quote info:', feeEstimation.quote);
```

### Intent Signers

The SDK supports multiple intent signing methods using factory functions:

#### NEAR KeyPair Signer
```typescript
import { createIntentSignerNearKeyPair, BridgeSDK } from '@defuse-protocol/bridge-sdk';
import { KeyPair } from 'near-api-js';

const keyPair = KeyPair.fromString('your-private-key');
const signer = createIntentSignerNearKeyPair({
  keypair: keyPair,
  accountId: 'your-account.near'
});
```

#### NEP-413 Signer
```typescript
import { createIntentSignerNEP413 } from '@defuse-protocol/bridge-sdk';

const signer = createIntentSignerNEP413({
  signMessage: async (nep413Payload, nep413Hash) => {
    // Implement your custom signing logic here
    return {
      publicKey: 'ed25519:YourPublicKey',
      signature: 'base64-encoded-signature'
    };
  },
  accountId: 'your-account.near'
});
```

#### EVM/Viem Signer
```typescript
import { createIntentSignerViem } from '@defuse-protocol/bridge-sdk';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');
const signer = createIntentSignerViem(account);

// Set the signer at runtime
sdk.setIntentSigner(signer);
```

## Advanced Usage

### Custom RPC URLs

Set NEAR and EVM chains RPC URLs in the constructor: 

```typescript
const sdk = new BridgeSDK({
    ...,
    nearRpc: ['https://rpc.mainnet.near.org'],
    evmRpc: {
        137: ['https://polygon-rpc.com/'], // Polygon
        56: ['https://bsc-dataseed.binance.org/'], // BNB Chain
        // Add other HOT bridge supported networks: Optimism (10), Avalanche (43114)
    },
});
```

### Batch Withdrawals

Process multiple withdrawals in a single transaction:

```typescript
const batchWithdrawal = sdk.createBatchWithdrawals({
  withdrawalParams: [
    {
      assetId: 'nep141:usdt.tether-token.near',
      amount: 1000000n,
      destinationAddress: '0x742d35Cc...',
      destinationMemo: undefined,
      feeInclusive: false
    },
    {
      assetId: 'nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L',
      amount: 100000n,
      destinationAddress: '0x742d35Cc...',
      destinationMemo: undefined,
      feeInclusive: false
    }
  ]
});

// Process all withdrawals at once
await batchWithdrawal.process();

// Or step by step:
// await batchWithdrawal.estimateFee();
// if (batchWithdrawal.hasUnprocessableWithdrawals()) {
//   console.log('Removing unprocessable withdrawals:', batchWithdrawal.removeUnprocessableWithdrawals());
// }
// await batchWithdrawal.signAndSendIntent();
// await batchWithdrawal.waitForIntentSettlement();
// await batchWithdrawal.waitForWithdrawalCompletion();
```

### Dynamically add withdrawals to Batch Withdrawals

TDB

### Route Configuration Factory Functions

**Recommended**: Use factory functions to create route configurations. The SDK provides factory functions for type-safe and convenient route configuration creation:

```typescript
import { 
  createVirtualChainRoute, 
  createNearWithdrawalRoute, 
  createInternalTransferRoute 
} from '@defuse-protocol/bridge-sdk';

// Create virtual chain route configuration (recommended)
const virtualChainRoute = createVirtualChainRoute(
  '0x4e45415f.c.aurora', // Aurora Engine contract ID
  null // Proxy token contract ID (optional)
);

// Create near withdrawal route with custom message
const nearWithdrawalRoute = createNearWithdrawalRoute(
  'Custom withdrawal message' // Optional message
);

// Create internal transfer route
const internalTransferRoute = createInternalTransferRoute();

// Use the factory-created route configuration in withdrawal
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:a35923162c49cf95e6bf26623385eb431ad920d3.factory.bridge.near',
    amount: BigInt('1000000'),
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false,
    routeConfig: virtualChainRoute // Recommended: Use factory function
  }
});

await withdrawal.process();
```

### Asset Information Parsing

Get detailed information about supported assets:

```typescript
try {
  const assetInfo = sdk.parseAssetId('nep141:usdt.tether-token.near');
  console.log('Bridge name:', assetInfo.bridgeName);
  console.log('Blockchain:', assetInfo.blockchain);
  console.log('Contract ID:', assetInfo.contractId);
  console.log('Standard:', assetInfo.standard);
} catch (error) {
  console.log('Asset not supported');
}
```

### Waiting for Completion

Monitor withdrawal completion:

```typescript
const withdrawal = sdk.createWithdrawal({
  withdrawalParams: { /* ... */ }
});

// Execute step by step for monitoring
await withdrawal.estimateFee();
await withdrawal.signAndSendIntent();
const intentTx = await withdrawal.waitForIntentSettlement();
console.log('Intent settled:', intentTx.hash);

// Wait for the withdrawal to complete on the destination chain
const completionResult = await withdrawal.waitForWithdrawalCompletion();

if ('hash' in completionResult) {
  console.log('Withdrawal completed with hash:', completionResult.hash);
} else {
  console.log('Withdrawal completion not trackable for this bridge');
}
```

### Error Handling

```typescript
import { FeeExceedsAmountError, MinWithdrawalAmountError } from '@defuse-protocol/bridge-sdk';

const withdrawal = sdk.createWithdrawal({
    withdrawalParams: {
        assetId: 'nep141:usdt.tether-token.near',
        amount: BigInt('100'), // Very small amount
        destinationAddress: '0x742d35Cc...',
        destinationMemo: undefined,
        feeInclusive: true // Fee must be less than amount
    }
});

try {
  await withdrawal.process();
} catch (error) {
  if (error instanceof FeeExceedsAmountError) {
    console.log('Fee exceeds withdrawal amount');
    console.log('Required fee:', error.feeEstimation.amount);
    console.log('Withdrawal amount:', error.amount);
  } else if (error instanceof MinWithdrawalAmountError) {
    console.log('Amount below minimum withdrawal limit');
    console.log('Minimum required:', error.minAmount);
    console.log('Requested amount:', error.requestedAmount);
    console.log('Asset:', error.assetId);
  }
}
```

### POA Bridge Minimum Withdrawal Amount Validation

POA bridge has minimum withdrawal amount requirements that vary per token and blockchain. The SDK automatically validates this for all withdrawals.

```typescript
// Validation happens automatically during withdrawal processing:
try {
  const withdrawal = sdk.createWithdrawal({
    withdrawalParams: {
      assetId: 'nep141:zec.omft.near', // Zcash token
      amount: BigInt('50000000'), // 0.5 ZEC (in smallest units)
      destinationAddress: 'your-zcash-address',
      destinationMemo: undefined,
      feeInclusive: false
    }
  });
  
  await withdrawal.process(); // Validation happens here
} catch (error) {
  if (error instanceof MinWithdrawalAmountError) {
    console.log(`Minimum withdrawal for ${error.assetId}: ${error.minAmount}`);
    console.log(`Requested amount: ${error.requestedAmount}`);
    // For Zcash: minimum is typically 1.0 ZEC (100000000 in smallest units)
    // Plus 0.2 ZEC fee, so user needs at least 1.2 ZEC to withdraw 1.0 ZEC
  }
}
```

Note: Other routes (Near Withdrawal, Virtual Chain, Hot Bridge, Internal Transfer) don't have minimum withdrawal restrictions, so validation passes through for those routes.

TBD

## Supported Networks

The SDK supports transfers across multiple blockchain networks:

- **Ethereum** (`eip155:1`)
- **Base** (`eip155:8453`) 
- **Arbitrum** (`eip155:42161`)
- **Polygon** (`eip155:137`)
- **BNB Smart Chain** (`eip155:56`)
- **NEAR** (`near:mainnet`)
- **Gnosis** (`eip155:100`)
- **And more...**

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- [pnpm](https://pnpm.io/) for package management

### Setup

```bash
# Install dependencies (from the monorepo root)
pnpm install
```

### Build

```bash
# Build the package
pnpm run build

# Build in watch mode
pnpm run dev
```

### Test

```bash
# Run tests
pnpm run test

# Run tests in watch mode  
pnpm run test:watch
```

### Lint and Format

```bash
# Check code style
pnpm run lint

# Format code
pnpm run format
```

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and migration guides.

## Contributing

This package is part of Near Intents SDK monorepo. Please refer to the main repository's contributing guidelines.

## License

MIT

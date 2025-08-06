# @defuse-protocol/bridge-sdk

The Bridge SDK for Near Intents provides a set of tools for interacting with various bridge implementations. It simplifies the process of transferring assets from Near Intents to different blockchains.

## Features

- Bridging from Near Intents:
  - Support for multiple bridge implementations (Hot, PoA)
  - Single and batch withdrawal operations
  - Automatic fee estimation
  - Built-in validation for withdrawal constraints:
    - PoA Bridge minimum withdrawal amounts
    - Hot Bridge Stellar trustline validation
  - Transfers within Near Intents
  - Transfers to NEAR blockchain
  - Transfers to Virtual Chains (e.g. Aurora)



Note: Bridging to Near Intents is not supported yet.
  
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

// Method 1: Complete end-to-end withdrawal (orchestrated)
const result = await sdk.processWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near', // Asset identifier
    amount: 1000000n, // Amount in smallest unit
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false, // Whether amount includes fees
    // routeConfig is optional - will be auto-detected from assetId
  }
});

console.log('Intent hash:', result.intentHash);
console.log('Destination tx:', result.destinationTx);

// Method 2: Granular control with individual methods
const feeEstimation = await sdk.estimateWithdrawalFee({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false
  }
});

const { intentHash } = await sdk.signAndSendWithdrawalIntent({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false
  },
  feeEstimation
});

const intentTx = await sdk.waitForIntentSettlement({ intentHash });
const destinationTx = await sdk.waitForWithdrawalCompletion({ 
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false
  }, 
  intentTx 
});
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

The SDK now supports both single and batch fee estimation:

```typescript
// Single withdrawal fee estimation
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
console.log('Quote info:', feeEstimation.quote); // null if fee paid with withdrawn token

// Batch fee estimation
const batchFees = await sdk.estimateWithdrawalFee({
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
      amount: 500000n,
      destinationAddress: '0x742d35Cc...',
      destinationMemo: undefined,
      feeInclusive: false
    }
  ]
});

console.log('Batch fees:', batchFees); // Array of FeeEstimation objects
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
import { Chains } from '@defuse-protocol/bridge-sdk'

const sdk = new BridgeSDK({
    ...,
    rpc: {
        [Chains.Near]: ['https://rpc.mainnet.near.org'],
        [Chains.Polygon]: ['https://polygon-rpc.com'],
        [Chains.BNB]: ['https://bsc-dataseed.binance.org'],
    }
});
```

### Intent Publishing Hooks

Use the `onBeforePublishIntent` hook to intercept and process intent data before it's published to the relayer. This is useful for persistence, logging, analytics, or custom processing:

```typescript
import { type OnBeforePublishIntentHook } from '@defuse-protocol/bridge-sdk';

// Define your hook function
const onBeforePublishIntent: OnBeforePublishIntentHook = async (intentData) => {
  // Save to database for tracking
  await saveIntentToDatabase({
    hash: intentData.intentHash,
    payload: intentData.intentPayload,
    timestamp: new Date(),
  });
  
  // Send analytics
  analytics.track('intent_about_to_publish', {
    intentHash: intentData.intentHash,
    intentType: intentData.intentPayload.intents[0]?.intent,
  });
};

// Use the hook with the functional API
const result = await sdk.processWithdrawal({
  withdrawalParams: { /* ... */ },
  intent: {
    onBeforePublishIntent, // Add the hook here
  }
});

// Or with granular control
const { intentHash } = await sdk.signAndSendWithdrawalIntent({
  withdrawalParams: { /* ... */ },
  feeEstimation: fee,
  intent: {
    onBeforePublishIntent, // Add the hook here
  }
});

// Or with generic intent publishing
const { intentHash } = await sdk.signAndSendIntent({
  intents: [/* ... */],
  onBeforePublishIntent, // Add the hook here
});
```

**Hook Parameters:**
- `intentHash` - The computed hash of the intent payload
- `intentPayload` - The unsigned intent payload
- `multiPayload` - The signed multi-payload containing signature and metadata
- `relayParams` - Additional parameters passed to the relayer (quote hashes)

**Important Notes:**
- The hook is called synchronously before publishing the intent
- If the hook throws an error, the withdrawal will fail
- The hook can be async and return a Promise

### Batch Withdrawals

Process multiple withdrawals in a single intent:

```typescript
const withdrawalParams = [
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

// Method 1: Complete end-to-end batch processing
const batchResult = await sdk.processWithdrawal({
  withdrawalParams,
  // feeEstimation is optional - will be estimated automatically if not provided
});

console.log('Batch intent hash:', batchResult.intentHash);
console.log('Destination transactions:', batchResult.destinationTx); // Array of results

// Method 2: Step-by-step batch processing for granular control
const feeEstimation = await sdk.estimateWithdrawalFee({
  withdrawalParams
});

const { intentHash } = await sdk.signAndSendWithdrawalIntent({
  withdrawalParams,
  feeEstimation
});

const intentTx = await sdk.waitForIntentSettlement({ intentHash });

const destinationTxs = await sdk.waitForWithdrawalCompletion({
  withdrawalParams,
  intentTx
});

console.log('All destination transactions:', destinationTxs);
```

### Intent Management

The SDK provides direct access to intent operations for advanced use cases:

```typescript
// Generic intent signing and publishing
const { intentHash } = await sdk.signAndSendIntent({
  intents: [/* array of intent primitives */],
  signer: customIntentSigner, // optional - uses SDK default if not provided
  onBeforePublishIntent: async (data) => {
    // Custom logic before publishing
    console.log('About to publish intent:', data.intentHash);
  }
});

// Wait for intent settlement
const intentTx = await sdk.waitForIntentSettlement({ 
  intentHash 
});

// or manual status check

// Check intent status at any time
const status = await sdk.getIntentStatus({ 
  intentHash: intentHash 
});

console.log('Intent status:', status.status); // "PENDING" | "TX_BROADCASTED" | "SETTLED" | "NOT_FOUND_OR_NOT_VALID"

if (status.status === 'SETTLED') {
  console.log('Settlement transaction:', status.txHash);
}
```

**Intent Status Values:**
- `PENDING` - Intent published but not yet processed
- `TX_BROADCASTED` - Intent being processed, transaction broadcasted
- `SETTLED` - Intent successfully completed
- `NOT_FOUND_OR_NOT_VALID` - Intent not found or invalid, it isn't executed onchain

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
const result = await sdk.processWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:a35923162c49cf95e6bf26623385eb431ad920d3.factory.bridge.near',
    amount: BigInt('1000000'),
    destinationAddress: '0x742d35Cc6634C0532925a3b8D84B2021F90a51A3',
    destinationMemo: undefined,
    feeInclusive: false,
    routeConfig: virtualChainRoute // Recommended: Use factory function
  }
});
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
// Method 1: Using the orchestrated approach (automatic monitoring)
const result = await sdk.processWithdrawal({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc...',
    destinationMemo: undefined,
    feeInclusive: false
  }
});

console.log('Intent settled:', result.intentTx.hash);
console.log('Withdrawal completed:', result.destinationTx);

// Method 2: Step-by-step monitoring for granular control
const feeEstimation = await sdk.estimateWithdrawalFee({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc...',
    destinationMemo: undefined,
    feeInclusive: false
  }
});

const { intentHash } = await sdk.signAndSendWithdrawalIntent({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc...',
    destinationMemo: undefined,
    feeInclusive: false
  },
  feeEstimation
});

// Monitor intent settlement
const intentTx = await sdk.waitForIntentSettlement({ intentHash });
console.log('Intent settled:', intentTx.hash);

// Wait for withdrawal completion on destination chain
const completionResult = await sdk.waitForWithdrawalCompletion({
  withdrawalParams: {
    assetId: 'nep141:usdt.tether-token.near',
    amount: 1000000n,
    destinationAddress: '0x742d35Cc...',
    destinationMemo: undefined,
    feeInclusive: false
  },
  intentTx
});

if ('hash' in completionResult) {
  console.log('Withdrawal completed with hash:', completionResult.hash);
} else {
  console.log('Withdrawal completion not trackable for this bridge');
}
```

### Error Handling

```typescript
import { FeeExceedsAmountError, MinWithdrawalAmountError } from '@defuse-protocol/bridge-sdk';

try {
  const result = await sdk.processWithdrawal({
    withdrawalParams: {
      assetId: 'nep141:usdt.tether-token.near',
      amount: BigInt('100'), // Very small amount
      destinationAddress: '0x742d35Cc...',
      destinationMemo: undefined,
      feeInclusive: true // Fee must be less than amount
    }
  });
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

// Error handling with granular control
try {
  const feeEstimation = await sdk.estimateWithdrawalFee({
    withdrawalParams: {
      assetId: 'nep141:usdt.tether-token.near',
      amount: 100n,
      destinationAddress: '0x742d35Cc...',
      destinationMemo: undefined,
      feeInclusive: true
    }
  });
  
  // Continue with other operations...
} catch (error) {
  // Handle specific errors at each step
  console.error('Fee estimation failed:', error);
}
```

#### PoA Bridge Minimum Withdrawal Amount Validation

PoA bridge has minimum withdrawal amount requirements that vary per token and blockchain. The SDK automatically validates this for all withdrawals.

```typescript
// Validation happens automatically during withdrawal processing:
try {
  const result = await sdk.processWithdrawal({
    withdrawalParams: {
      assetId: 'nep141:zec.omft.near', // Zcash token
      amount: BigInt('50000000'), // 0.5 ZEC (in smallest units)
      destinationAddress: 'your-zcash-address',
      destinationMemo: undefined,
      feeInclusive: false
    }
  });
} catch (error) {
  if (error instanceof MinWithdrawalAmountError) {
    console.log(`Minimum withdrawal for ${error.assetId}: ${error.minAmount}`);
    console.log(`Requested amount: ${error.requestedAmount}`);
    // For Zcash: minimum is typically 1.0 ZEC (100000000 in smallest units)
    // Plus 0.2 ZEC fee, so user needs at least 1.2 ZEC to withdraw 1.0 ZEC
  }
}
```

Note: Other routes (Near Withdrawal, Virtual Chain, Internal Transfer) don't have minimum withdrawal restrictions, so validation passes through for those routes.

#### Hot Bridge Stellar Trustline Validation

Hot Bridge validates that destination addresses have the required trustlines when withdrawing to Stellar blockchain. This prevents failed transactions due to missing trustlines.

```typescript
import { TrustlineNotFoundError } from '@defuse-protocol/bridge-sdk';

// Validation happens automatically during withdrawal processing:
try {
  const result = await sdk.processWithdrawal({
    withdrawalParams: {
      assetId: 'nep245:v2_1.omni.hot.tg:stellar_1_USD_GBDMM6LG7YX7YGF6JFAEWX3KFUSBXGAEPZ2IHDLWH:1100', // Stellar USD token
      amount: BigInt('1000000'), // 1 USD (in smallest units)
      destinationAddress: 'GCKFBEIYTKP6RYVDYGMVVMJ6J6XKCRZL74JPWTFGD2NQNMPBQC2LGTVZ', // Stellar address
      destinationMemo: undefined,
      feeInclusive: false
    }
  });
} catch (error) {
  if (error instanceof TrustlineNotFoundError) {
    console.log(`Trustline not found for token: ${error.assetId}`);
    console.log(`Destination address: ${error.destinationAddress}`);
    console.log('The destination address must have a trustline for this token before withdrawal');
    // User needs to create a trustline for the token on Stellar before withdrawing
  }
}
```

**What is a trustline?**
On Stellar, accounts must explicitly create "trustlines" to hold non-native assets. Before receiving any token (except XLM), the destination address must:
1. Create a trustline for that specific token
2. Have sufficient XLM balance to maintain the trustline

**Why this validation matters:**
- Prevents failed withdrawals due to missing trustlines
- Saves gas fees and reduces user frustration
- Provides clear error messages for troubleshooting

Note: This validation only applies to Stellar destinations via Hot Bridge. Other blockchains and routes don't require trustline validation.

TBD

## Supported Networks

For a list of supported chains, see the [Chain Support page](https://docs.near-intents.org/near-intents/chain-address-support) in the Near Intents documentation.

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

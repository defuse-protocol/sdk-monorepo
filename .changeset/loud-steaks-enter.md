---
"@defuse-protocol/bridge-sdk": minor
---

Replace `nearRpc`, `evmRpc` and `stellarRpc` configs with a unified `rpc` config. Example:
```typescript
import { Chains, BridgeSDK } from '@defuse-protocol/bridge-sdk'

const sdk = new BridgeSDK({
    rpc: {
        [Chains.Near]: ['https://rpc.mainnet.near.org'],
        [Chains.Polygon]: ['https://polygon-rpc.com'],
        [Chains.BNB]: ['https://bsc-dataseed.binance.org'],
    }
});
```
---
"@defuse-protocol/internal-utils": minor
"@defuse-protocol/bridge-sdk": minor
---

Re-organize package exports. 

Renamed:
- `CAIP2_NETWORK` -> `Chains` and `Chain` type

Removed:
- `HOT_BRIDGE_CHAINS_CAIP2`
- Intent relayer

Added:
- `createPoaBridgeRoute()` and `createHotBridgeRoute()`
- Types: `BridgeSDKConfig`, `WithdrawalIdentifier`, `NearWithdrawalRouteConfig`, `InternalTransferRouteConfig`, `VirtualChainRouteConfig`, `PoaBridgeRouteConfig`, `HotBridgeRouteConfig`, `NearTxInfo`, `TxInfo`, `TxNoInfo`, `ParsedAssetInfo`, `ILogger`, `RetryOptions`, `NearIntentsEnv`, `IntentPrimitive`, `IntentPayload`, `IntentPayloadFactory`, `IntentRelayParamsFactory`, `MultiPayload`
- All error types
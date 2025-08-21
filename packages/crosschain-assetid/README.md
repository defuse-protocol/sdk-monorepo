# 1cs_v1 — Unified Cross-Chain Asset Identifier

## Installation

```bash
npm install @defuse-protocol/crosschain-assetid
```

## Usage

```typescript
import {parse1cs, stringify1cs} from '@defuse-protocol/crosschain-assetid';

const assetid = stringify1cs({
  version: "v1",
  chain: "eth",
  namespace: "erc20",
  reference: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
})

const obj = parse1cs("1cs_v1:eth:erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
```

## Purpose

`1cs_v1` is a **URL-safe, compact, human-readable** identifier format for
representing **any asset** (crypto token, NFT, native coin, wrapped/bridged asset,
or even fiat) **across chains** in a consistent way.

It is designed to:

- Let apps **refer to assets unambiguously** without chain-specific parsing logic.
- Work **cross-chain and cross-standard** — one format for EVM, Solana, Cosmos, NEAR,
  Stellar, Aptos, Sui, fiat, etc.
- Be **safe in URLs, filenames, and APIs** without extra escaping.
- Enable **simple parsing** into an object with predictable fields.
- Serve as a **unified key** for balances, swaps, bridges, quotes, and off-ramps.

---

## Format

```
1cs_v1:<chain>:<namespace>:<reference>[:<selector>]
```

### Components

| Part          | Required? | Description                                                                                                                                      |
|---------------|-----------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `1cs_v1`      | ✅         | Format prefix and version. 1cs stands for [1ClickSwap](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api). |
| `<chain>`     | ✅         | Lowercase slug (e.g. `eth`, `eth-sepolia`, `solana`, `near`, `polygon`), can encode testnet in slug.                                             |
| `<namespace>` | ✅         | Asset standard/kind: `erc20`, `erc721`, `spl`, `near-nft`, `aptos-coin`, `fiat`, etc.                                                            |
| `<reference>` | ✅         | Contract/mint/account/denom/issuer — **URI-encoded** to safely hold `:`, `/`, spaces, unicode, etc.                                              |
| `<selector>`  | optional  | Sub-asset selector: token ID, module struct, Stellar code, etc. — also **URI-encoded**.                                                          |

---

## Examples

### Fungible tokens

```
1cs_v1:eth:erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48    # USDC on Ethereum
1cs_v1:base:erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # USDC on Base
1cs_v1:fiat:iso4217:USD                                        # US Dollar (fiat)
```

### NFTs

```
1cs_v1:eth:erc721:0x1234567890abcdef1234567890abcdef12345678:42
1cs_v1:near:nep171:apes.coolnft.near:series%3A1%2Fblue%3A42
```

### Native coins

```
1cs_v1:eth:native:coin
1cs_v1:zcash:native:coin
```

### Non-EVM standards

```
1cs_v1:solana:spl:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
1cs_v1:aptos:aptos-coin:0x1%3A%3Aaptos_coin%3A%3AAptosCoin
```

---

## Rationale & Design Choices

### 1. URL safety

We encode `reference` and `selector` with `encodeURIComponent` so they are safe in URLs.

### 2. Human-readable but unambiguous

- Prefix (`1cs_v1`) makes it clear what format is in use. Easy greppable across codebase.
- Chain slug + namespace covers most identification needs without extra lookups.
- Works for *both* blockchain and fiat.

### 3. Multi-asset support

`selector` cleanly supports ERC-1155 IDs, Stellar asset codes, Cosmos token sub-denoms, Aptos/Sui struct names, etc.

### 4. Bridged / wrapped assets

The ID identifies the *on-chain representation*. If you need to express the *origin*, bridge, issuer, or other
metadata — pass it as **query params** or in your object model, not in the core ID.

---

## Object Form

Parsing a `1cs_v1` string gives you:

```ts
interface OneCsAsset {
    version: "v1";
    chain: string;      // e.g. "eth", "near", "fiat"
    namespace: string;  // e.g. "erc20", "spl", "native"
    reference: string;  // decoded from URI
    selector?: string;  // decoded from URI if present
}
```

Example:

```
1cs_v1:near:nep171:apes.coolnft.near:series%3A1%2Fblue%3A42
↓
{
  version: "v1",
  chain: "near",
  namespace: "nep171",
  reference: "apes.coolnft.near",
  selector: "series:1/blue:42"
}
```

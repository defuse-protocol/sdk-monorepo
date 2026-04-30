# @defuse-protocol/wallet-sdk

SDK for NEAR wallet contracts with WebAuthn (passkey) signing and MPC key derivation.

## Install

```bash
pnpm add @defuse-protocol/wallet-sdk
```

## Quick start

```ts
import { OneClickClient } from "@defuse-protocol/wallet-sdk";
import { WalletWebAuthnP256 } from "@defuse-protocol/wallet-sdk";
import { DomainId, MpcContract } from "@defuse-protocol/wallet-sdk";
import { hex } from "@scure/base";

// 1. Create the HTTP client pointing to the relayer
const client = new OneClickClient({
  baseUrl: "http://localhost:3000",
  authToken: "optional-jwt-token",
});

// 2. Create wallet from a P-256 public key (hex, compressed or uncompressed)
const wallet = new WalletWebAuthnP256(client, publicKeyHex);

// 3. Derive the NEAR account ID (0s...)
const accountId = wallet.deriveAccountId();

// 4. Derive cross-chain public keys
const secp256k1Key = await wallet.derivePublicKey("", DomainId.Secp256k1);
const ed25519Key = await wallet.derivePublicKey("", DomainId.Ed25519);

// 5. Build a sign request
const mpc = new MpcContract();
const request = mpc.buildSignMpcRequest(
  DomainId.Secp256k1,
  hex.decode("abcd..."),
);
const message = await wallet.buildRequestMessage(request);

// 6. Get WebAuthn challenge and sign it
const challenge = wallet.challenge(message);
// ... use navigator.credentials.get() with the challenge ...
const proof = wallet.buildProof(assertionResponse);

// 7. Send to relayer
const { status, body } = await wallet.sendSign({ message, proof });
```

## OneClickClient

HTTP client for the 1Click relayer. Passes `Authorization: Bearer <token>` on every request when `authToken` is provided.

```ts
const client = new OneClickClient({
  baseUrl: "http://localhost:3000",
  authToken: "my-jwt", // optional
});
```

### Methods

| Method | Endpoint | Description |
|---|---|---|
| `sign(body)` | `POST /v0/sign` | Submit signed request message + proof |
| `derivePublicKey(body)` | `POST /v0/derive-public-key` | Derive a cross-chain public key |

## Frontend test page

A browser test page is included for manual end-to-end testing.

### Prerequisites

The relayer must be running locally (default `http://localhost:3000`).

### Run

```bash
cd packages/wallet-sdk
pnpm test:browser
```

This opens a Vite dev server with the test page. The flow:

1. **Create Passkey** -- creates a WebAuthn credential via the browser, displays the NEAR account ID (`0s...`) and derived Secp256k1/Ed25519 public keys.
2. **Prepare** -- builds a `RequestMessage` with an MPC sign request and computes the challenge.
3. **Sign Challenge** -- triggers WebAuthn assertion signing, builds the proof.
4. **Send** -- submits the signed request to the relayer via `OneClickClient` and shows the response with round-trip duration.

Configure the **Base URL** and **Auth Token** fields at the top before creating the passkey -- these are passed to `OneClickClient` on wallet creation.

## Development

```bash
pnpm build        # build the package
pnpm typecheck    # check types
pnpm lint:fix     # lint + format
pnpm test:browser # open the test page
```
